/**
 * Stripe Products and Pricing Configuration
 * Defines subscription tiers and metered pricing for LARO platform
 */

export const STRIPE_PRODUCTS = {
  // Pro tier with metered billing
  pro: {
    name: 'LARO Pro',
    description: 'Unlimited access with pay-as-you-go metered billing',
    prices: {
      // Base subscription (monthly)
      base: {
        amount: 2900, // $29/month base fee
        currency: 'usd',
        interval: 'month' as const,
        description: 'Monthly base subscription',
      },
      // Metered usage pricing
      metered: {
        currency: 'usd',
        interval: 'month' as const,
        usage_type: 'metered' as const,
        aggregate_usage: 'sum' as const,
        billing_scheme: 'per_unit' as const,
        description: 'Pay-as-you-go resource usage',
        // Tiers for volume discounts (optional)
        tiers_mode: 'graduated' as const,
        tiers: [
          {
            up_to: 1000,      // First 1000 units
            unit_amount: 1,   // $0.01 per unit (already includes 2.5x markup)
          },
          {
            up_to: 10000,     // Next 9000 units
            unit_amount: 0.8, // $0.008 per unit (volume discount)
          },
          {
            up_to: 'inf' as any, // Unlimited
            unit_amount: 0.5, // $0.005 per unit (max volume discount)
          },
        ],
      },
    },
  },

  // Enterprise tier (custom pricing)
  enterprise: {
    name: 'LARO Enterprise',
    description: 'Custom pricing and dedicated support',
    prices: {
      base: {
        amount: 99900, // $999/month base fee
        currency: 'usd',
        interval: 'month' as const,
        description: 'Monthly enterprise subscription',
      },
    },
  },
} as const;

/**
 * Free tier limits (defined in usageTracking.ts)
 * - 10 AI email analyses per month
 * - 5 AI document analyses per month
 * - 10 AI legal inferences per month
 * - 50 email syncs per month
 * - 5 lawyer outreach per month
 * - 3 document generations per month
 * - 2 case analyses per month
 */

/**
 * Pricing display for frontend
 */
export const PRICING_DISPLAY = {
  free: {
    name: 'Free',
    price: '$0',
    interval: 'forever',
    features: [
      '2 case analyses',
      '10 AI email analyses',
      '5 AI document analyses',
      '50 email syncs',
      '5 lawyer outreach',
      '3 document generations',
    ],
    limitations: [
      'Limited to monthly quotas',
      'No priority support',
    ],
    cta: 'Get Started',
  },
  pro: {
    name: 'Pro',
    price: '$29',
    interval: 'per month',
    basePrice: '$29/month base',
    meteredPrice: '+ metered usage',
    features: [
      'Unlimited case analyses',
      'Unlimited AI analyses',
      'Unlimited email syncs',
      'Unlimited lawyer outreach',
      'Unlimited document generation',
      'Pay only for what you use',
      'Volume discounts',
      'Priority email support',
    ],
    pricing: [
      'First 1,000 units: $0.01/unit',
      'Next 9,000 units: $0.008/unit',
      '10,000+ units: $0.005/unit',
    ],
    cta: 'Upgrade to Pro',
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Custom',
    interval: 'contact us',
    features: [
      'Everything in Pro',
      'Custom pricing',
      'Dedicated account manager',
      'SLA guarantees',
      'Custom integrations',
      'White-label options',
      'Phone & priority support',
    ],
    cta: 'Contact Sales',
  },
} as const;

