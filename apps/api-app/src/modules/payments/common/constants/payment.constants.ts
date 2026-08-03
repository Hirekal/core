/**
 * @fileoverview Payment module configuration and shared constants.
 */
export const PAYMENT_CONSTANTS = {
  DEFAULT_PROVIDER_CODE: 'STRIPE',
  CURRENCY_DEFAULT: 'USD',
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
