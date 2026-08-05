/**
 * @fileoverview Payment module error, success, and log message constants.
 */
export const ERROR_MESSAGES = {
  PAYMENT_PROVIDER: {
    NOT_FOUND: 'Payment provider not found',
    UNSUPPORTED: (code: string) => `Unsupported payment provider: ${code}`,
    NOT_CONFIGURED: (code: string) =>
      `Payment provider not configured: ${code}`,
  },
  PAYMENT_CUSTOMER: {
    NOT_FOUND: 'Payment customer not found',
    ALREADY_EXISTS:
      'Payment customer already exists for this user and provider',
  },
  PRODUCT: {
    NOT_FOUND: 'Product not found',
    CODE_ALREADY_EXISTS: 'Product code already exists',
  },
  PRICE: {
    NOT_FOUND: 'Price not found',
    ALREADY_EXISTS: 'Price already exists for this provider',
  },
  SUBSCRIPTION: {
    NOT_FOUND: 'Subscription not found',
    RESUME_NOT_SUPPORTED:
      'Resume subscription is not supported for this provider',
    SAME_PLAN: 'Subscription is already on the requested plan',
    PLAN_PROVIDER_MISMATCH:
      'Requested price belongs to a different payment provider',
    INVALID_PLAN_CHANGE:
      'Plan change requires a different price amount (upgrade or downgrade)',
    INVALID_UPGRADE:
      'Requested plan is not an upgrade from the current subscription plan',
    INVALID_DOWNGRADE:
      'Requested plan is not a downgrade from the current subscription plan',
    CURRENCY_MISMATCH:
      'Plan change requires the same currency as the current subscription',
    INTERVAL_NOT_SUPPORTED:
      'Plan change is not supported for the selected billing interval',
    NOT_CHANGEABLE: 'Subscription must be active or trialing to change plans',
    MISSING_PAYMENT_METHOD:
      'A default payment method is required before upgrading the subscription',
    PAYMENT_REQUIRED:
      'Payment is required to complete the subscription plan change',
    PAYMENT_FAILED: 'Payment failed while changing the subscription plan',
    NO_SCHEDULED_CHANGE:
      'No scheduled plan change exists for this subscription',
    CHANGE_PLAN_NOT_SUPPORTED: 'Plan change is not supported for this provider',
    PREVIEW_NOT_SUPPORTED:
      'Plan change preview is not supported for this provider',
  },
  STRIPE: {
    MISSING_PAYMENT_METHOD:
      'Customer has no attached payment method or default payment method',
    PAYMENT_FAILED: 'Payment failed while processing the Stripe request',
    INVALID_CUSTOMER: 'Invalid Stripe customer',
    RESOURCE_MISSING: 'The requested Stripe resource was not found',
    REQUEST_FAILED: (message: string) =>
      message.replace(/sk_(test|live)_[^\s]+/g, '[redacted]'),
  },
  PAYMENT: {
    NOT_FOUND: 'Payment not found',
    SUBSCRIPTION_NOT_LINKED:
      'Payment could not be linked to a subscription',
    CHECKOUT_PAYMENT_INTENT_NOT_FOUND:
      'Could not resolve payment intent for checkout subscription',
  },
  PAYMENT_METHOD: {
    NOT_FOUND: 'Payment method not found',
  },
  INVOICE: {
    NOT_FOUND: 'Invoice not found',
  },
  WEBHOOK: {
    MISSING_PAYLOAD: 'Missing webhook payload',
    INVALID_SIGNATURE: 'Invalid webhook signature',
    EVENT_ALREADY_PROCESSED: 'Webhook event already processed',
    PROCESSING_FAILED: 'Webhook event processing failed',
  },
  CHECKOUT: {
    SESSION_CREATE_FAILED: 'Failed to create checkout session',
    MISSING_PUBLISHABLE_KEY:
      'Stripe publishable key is not configured (STRIPE_PUBLISHABLE_KEY)',
  },
} as const;

export const SUCCESS_MESSAGES = {
  SUBSCRIPTION: {
    CANCELED: 'Subscription canceled successfully',
    RESUMED: 'Subscription resumed successfully',
    UPGRADED: 'Subscription upgraded successfully with proration',
    DOWNGRADED: 'Subscription downgrade scheduled for the next billing cycle',
    SCHEDULED_CHANGE_CANCELED:
      'Scheduled subscription plan change canceled successfully',
  },
  WEBHOOK: {
    RECEIVED: 'Webhook received',
  },
  CHECKOUT: {
    SUCCESS: 'Checkout completed successfully',
    CANCELED: 'Checkout was canceled',
  },
} as const;

export const LOG_MESSAGES = {
  REPOSITORY: {
    FIND_ONE_OR_FAIL: 'Repository findOneOrFail failed',
    CREATE_AND_SAVE: 'Repository createAndSave failed',
    SOFT_REMOVE_OR_FAIL: 'Repository softRemoveOrFail failed',
  },
  PAYMENT_PROVIDER: {
    LIST_FAILED: 'Failed to list payment providers',
    FIND_FAILED: (code: string) => `Failed to find payment provider: ${code}`,
  },
  PAYMENT_CUSTOMER: {
    CREATE_FAILED: (userId: string) =>
      `Failed to create payment customer for user: ${userId}`,
    UPDATE_FAILED: (id: string) => `Failed to update payment customer: ${id}`,
    FIND_FAILED: (id: string) => `Failed to find payment customer: ${id}`,
  },
  PRODUCT: {
    CREATE_FAILED: (code: string) => `Failed to create product: ${code}`,
    LIST_FAILED: 'Failed to list products',
    FIND_FAILED: (id: string) => `Failed to find product: ${id}`,
    UPDATE_FAILED: (id: string) => `Failed to update product: ${id}`,
    REMOVE_FAILED: (id: string) => `Failed to remove product: ${id}`,
  },
  PRICE: {
    CREATE_FAILED: (productId: string) =>
      `Failed to create price for product: ${productId}`,
    LIST_FAILED: 'Failed to list prices',
    FIND_FAILED: (id: string) => `Failed to find price: ${id}`,
  },
  SUBSCRIPTION: {
    CREATE_FAILED: (userId: string) =>
      `Failed to create subscription for user: ${userId}`,
    CANCEL_FAILED: (id: string) => `Failed to cancel subscription: ${id}`,
    RESUME_FAILED: (id: string) => `Failed to resume subscription: ${id}`,
    CHANGE_PLAN_FAILED: (id: string) =>
      `Failed to change subscription plan: ${id}`,
    FIND_FAILED: (id: string) => `Failed to find subscription: ${id}`,
    SYNC_FAILED: (providerId: string) =>
      `Failed to sync subscription: ${providerId}`,
  },
  PAYMENT: {
    SYNC_FAILED: (providerId: string) =>
      `Failed to sync payment: ${providerId}`,
  },
  PAYMENT_METHOD: {
    SYNC_FAILED: (providerId: string) =>
      `Failed to sync payment method: ${providerId}`,
  },
  INVOICE: {
    SYNC_FAILED: (providerId: string) =>
      `Failed to sync invoice: ${providerId}`,
    LIST_FAILED: (customerId: string) =>
      `Failed to list invoices for customer: ${customerId}`,
  },
  WEBHOOK: {
    RECEIVE_FAILED: (provider: string) =>
      `Failed to receive webhook for provider: ${provider}`,
    PROCESS_FAILED: (eventId: string) =>
      `Failed to process webhook event: ${eventId}`,
  },
  CHECKOUT: {
    CREATE_FAILED: (userId: string) =>
      `Failed to create checkout session for user: ${userId}`,
  },
  BILLING_PORTAL: {
    CREATE_FAILED: (userId: string) =>
      `Failed to create billing portal session for user: ${userId}`,
  },
} as const;
