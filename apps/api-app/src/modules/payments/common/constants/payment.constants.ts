/**
 * @fileoverview Payment module configuration and shared constants.
 */
export const PAYMENT_CONSTANTS = {
  DEFAULT_PROVIDER_CODE: 'STRIPE',
  CURRENCY_DEFAULT: 'USD',
  CATALOG_CACHE_TTL_MS: 2 * 60 * 60 * 1000,
  /** Global promotion-code redemption cap (Stripe promo max_redemptions). */
  COUPON_DEFAULT_MAXIMUM_REDEMPTIONS: 100,
  /** Each Stripe customer may redeem a given promotion code this many times. */
  COUPON_MAXIMUM_REDEMPTIONS_PER_CUSTOMER: 1,
} as const;

export const PAYMENT_CATALOG_CACHE_KEYS = {
  PRODUCTS_ALL: 'catalog:products:all',
  PRICES_ALL: 'catalog:prices:all',
  pricesByProduct: (productId: string) => `catalog:prices:product:${productId}`,
} as const;

export const STRIPE_WEBHOOK_EVENTS = {
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  INVOICE_CREATED: 'invoice.created',
  INVOICE_UPDATED: 'invoice.updated',
  INVOICE_FINALIZED: 'invoice.finalized',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
  SUBSCRIPTION_SCHEDULE_UPDATED: 'subscription_schedule.updated',
  SUBSCRIPTION_SCHEDULE_COMPLETED: 'subscription_schedule.completed',
  SUBSCRIPTION_SCHEDULE_RELEASED: 'subscription_schedule.released',
  SUBSCRIPTION_SCHEDULE_CANCELED: 'subscription_schedule.canceled',
} as const;

export const PAYMENT_PROVIDER_SEED = [
  {
    code: 'STRIPE',
    name: 'Stripe',
    description: 'Stripe payment gateway',
  },
  {
    code: 'RAZORPAY',
    name: 'Razorpay',
    description: 'Razorpay payment gateway',
  },
  {
    code: 'CASHFREE',
    name: 'Cashfree',
    description: 'Cashfree payment gateway',
  },
  {
    code: 'PAYPAL',
    name: 'PayPal',
    description: 'PayPal payment gateway',
  },
] as const;
