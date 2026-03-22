import type { Request, Response } from "express";
import Stripe from "stripe";
import {
  getStripe,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  isStripeConfigured,
} from "./stripeSubscription";

/**
 * Stripe webhook — used by `server/index.ts` with `express.raw` body.
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!isStripeConfigured()) {
    res.status(503).send("Stripe is not configured");
    return;
  }

  const sig = req.headers["stripe-signature"];

  if (!sig || typeof sig !== "string") {
    res.status(400).send("No signature");
    return;
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[STRIPE_WEBHOOK] Signature verification failed:", message);
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("[STRIPE_WEBHOOK] Handler error:", e);
    res.status(500).json({ error: "Webhook handler failed" });
    return;
  }

  res.json({ received: true });
}
