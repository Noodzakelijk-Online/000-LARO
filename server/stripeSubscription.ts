import Stripe from 'stripe';
import { getDb } from './db';
import { users, billingPeriods } from './schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { getUnreportedUsage, markUsageReported } from './usageTracking';

/**
 * Stripe Subscription Service
 * Manages subscriptions and metered billing with 2.5x markup
 */

const STRIPE_API_VERSION = '2025-02-24.acacia' as const;

let stripeSingleton: Stripe | null = null;

export function isStripeConfigured(): boolean {
  const off = process.env.STRIPE_DISABLED;
  if (off === "1" || off === "true") {
    return false;
  }
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  }
  return stripeSingleton;
}

/**
 * Create or get Stripe customer for user
 */
export async function getOrCreateStripeCustomer(userId: string, email: string, name?: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Check if user already has a Stripe customer ID
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user[0]?.stripeCustomerId) {
    return user[0].stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await getStripe().customers.create({
    email,
    name: name || undefined,
    metadata: {
      userId,
    },
  });

  // Save customer ID to database
  await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(users.id, userId));

  console.log(`[STRIPE] Created customer ${customer.id} for user ${userId}`);

  return customer.id;
}

/**
 * Create checkout session for Pro subscription
 */
export async function createProCheckoutSession(params: {
  userId: string;
  email: string;
  name?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionUrl: string; sessionId: string }> {
  const customerId = await getOrCreateStripeCustomer(params.userId, params.email, params.name);

  // Create checkout session
  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'LARO Pro',
            description: 'Unlimited access with pay-as-you-go metered billing',
          },
          recurring: {
            interval: 'month',
          },
          unit_amount: 2900, // $29/month base fee
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    client_reference_id: params.userId,
    metadata: {
      user_id: params.userId,
      customer_email: params.email,
      customer_name: params.name || '',
      tier: 'pro',
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  return {
    sessionUrl: session.url,
    sessionId: session.id,
  };
}

/**
 * Create Stripe Customer Portal session
 */
export async function createCustomerPortalSession(params: {
  userId: string;
  returnUrl: string;
}): Promise<{ portalUrl: string }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!user[0]?.stripeCustomerId) {
    throw new Error('User does not have a Stripe customer ID');
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: user[0].stripeCustomerId,
    return_url: params.returnUrl,
  });

  return {
    portalUrl: session.url,
  };
}

/**
 * Report usage to Stripe for metered billing
 * This should be called periodically (e.g., hourly via cron job)
 */
export async function reportUsageToStripe(userId?: string): Promise<{ reported: number; totalCost: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  if (!isStripeConfigured()) {
    console.log('[STRIPE] STRIPE_SECRET_KEY not set, skipping usage report');
    return { reported: 0, totalCost: 0 };
  }

  // Get unreported usage
  const unreportedUsage = await getUnreportedUsage(userId);

  if (unreportedUsage.length === 0) {
    console.log('[STRIPE] No unreported usage to sync');
    return { reported: 0, totalCost: 0 };
  }

  // Group usage by user
  const usageByUser: Record<string, typeof unreportedUsage> = {};
  for (const usage of unreportedUsage) {
    if (!usageByUser[usage.userId]) {
      usageByUser[usage.userId] = [];
    }
    usageByUser[usage.userId].push(usage);
  }

  let totalReported = 0;
  let totalCost = 0;

  // Report usage for each user
  for (const [uid, userUsage] of Object.entries(usageByUser)) {
    try {
      // Get user's subscription
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);

      if (!user[0]?.stripeSubscriptionId) {
        console.log(`[STRIPE] User ${uid} has no active subscription, skipping usage report`);
        continue;
      }

      // Calculate total usage quantity (sum of all billed costs)
      const totalBilledCost = userUsage.reduce((sum, u) => sum + parseFloat(u.billedCost || '0'), 0);
      const totalQuantity = Math.ceil(totalBilledCost); // Round up to nearest cent

      if (totalQuantity === 0) {
        continue;
      }

      // Get subscription items
      const subscription = await getStripe().subscriptions.retrieve(user[0].stripeSubscriptionId);
      
      // Find metered price item (or create one if needed)
      let meteredItem = subscription.items.data.find(item => 
        item.price.recurring?.usage_type === 'metered'
      );

      if (!meteredItem) {
        // Create metered price if it doesn't exist
        const meteredPrice = await getStripe().prices.create({
          currency: 'usd',
          recurring: {
            interval: 'month',
            usage_type: 'metered',
          },
          billing_scheme: 'per_unit',
          unit_amount: 1, // $0.01 per unit (already includes 2.5x markup)
          product_data: {
            name: 'LARO Resource Usage',
          },
        });

        // Add metered price to subscription
        const updatedSubscription = await getStripe().subscriptions.update(user[0].stripeSubscriptionId, {
          items: [
            ...subscription.items.data.map(item => ({ id: item.id })),
            { price: meteredPrice.id },
          ],
        });

        meteredItem = updatedSubscription.items.data.find(item => 
          item.price.id === meteredPrice.id
        );
      }

      if (!meteredItem) {
        throw new Error('Failed to create metered subscription item');
      }

      // Report usage to Stripe
      const usageRecord = await getStripe().subscriptionItems.createUsageRecord(
        meteredItem.id,
        {
          quantity: totalQuantity,
          timestamp: Math.floor(Date.now() / 1000),
          action: 'increment',
        }
      );

      // Mark usage as reported
      const usageIds = userUsage.map(u => u.id);
      await markUsageReported(usageIds, usageRecord.id);

      totalReported += userUsage.length;
      totalCost += totalBilledCost;

      console.log(`[STRIPE] Reported ${totalQuantity} units ($${(totalBilledCost / 100).toFixed(2)}) for user ${uid}`);

    } catch (error: any) {
      console.error(`[STRIPE] Error reporting usage for user ${uid}:`, error.message);
    }
  }

  return {
    reported: totalReported,
    totalCost,
  };
}

/**
 * Handle subscription created webhook
 */
export async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const userId = subscription.metadata.user_id;
  if (!userId) {
    console.error('[STRIPE] No user_id in subscription metadata');
    return;
  }

  await db
    .update(users)
    .set({
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status as any,
      subscriptionTier: subscription.metadata.tier as any || 'pro',
    })
    .where(eq(users.id, userId));

  console.log(`[STRIPE] Subscription ${subscription.id} created for user ${userId}`);
}

/**
 * Handle subscription updated webhook
 */
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const userId = subscription.metadata.user_id;
  if (!userId) {
    console.error('[STRIPE] No user_id in subscription metadata');
    return;
  }

  await db
    .update(users)
    .set({
      subscriptionStatus: subscription.status as any,
    })
    .where(eq(users.id, userId));

  console.log(`[STRIPE] Subscription ${subscription.id} updated for user ${userId}: ${subscription.status}`);
}

/**
 * Handle subscription deleted webhook
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const userId = subscription.metadata.user_id;
  if (!userId) {
    console.error('[STRIPE] No user_id in subscription metadata');
    return;
  }

  await db
    .update(users)
    .set({
      stripeSubscriptionId: null,
      subscriptionStatus: 'canceled',
      subscriptionTier: 'free',
    })
    .where(eq(users.id, userId));

  console.log(`[STRIPE] Subscription ${subscription.id} deleted for user ${userId}`);
}

/**
 * Handle invoice payment succeeded webhook
 */
export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const db = await getDb();
  if (!db) return;

  console.log(`[STRIPE] Invoice ${invoice.id} paid: $${(invoice.amount_paid / 100).toFixed(2)}`);

  // Create billing period record and clear grace period
  if (invoice.customer && invoice.subscription) {
    const subscription = await getStripe().subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.user_id;

    if (userId) {
      // Clear grace period (payment succeeded)
      const { clearGracePeriod } = await import('./gracePeriod');
      await clearGracePeriod(userId);
      
      await db.insert(billingPeriods).values({
        id: crypto.randomBytes(16).toString('hex'),
        userId,
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        totalBilledCost: invoice.amount_paid.toString(),
        stripeInvoiceId: invoice.id,
        status: 'completed',
      });
      
      console.log(`[STRIPE] Cleared grace period for user ${userId} (payment succeeded)`);
    }
  }
}

/**
 * Handle invoice payment failed webhook
 */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const db = await getDb();
  if (!db) return;

  console.error(`[STRIPE] Invoice ${invoice.id} payment failed`);

  // Start grace period
  if (invoice.subscription) {
    const subscription = await getStripe().subscriptions.retrieve(invoice.subscription as string);
    const userId = subscription.metadata.user_id;

    if (userId) {
      const { startGracePeriod } = await import('./gracePeriod');
      await startGracePeriod(userId);
      console.log(`[STRIPE] Started grace period for user ${userId} due to payment failure`);
    }
  }
}

