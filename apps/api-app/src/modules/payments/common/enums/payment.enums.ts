/**
 * @fileoverview Payment-related enum definitions (payment.enums).
 */
export enum PaymentProviderCode {
  STRIPE = 'STRIPE',
  RAZORPAY = 'RAZORPAY',
  CASHFREE = 'CASHFREE',
  PAYPAL = 'PAYPAL',
}

export enum RecordStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum PriceInterval {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
  ONE_TIME = 'ONE_TIME',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIALING = 'TRIALING',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  UNPAID = 'UNPAID',
  INCOMPLETE = 'INCOMPLETE',
}

export enum PaymentMethodType {
  CARD = 'CARD',
  UPI = 'UPI',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  WALLET = 'WALLET',
  NETBANKING = 'NETBANKING',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PAID = 'PAID',
  VOID = 'VOID',
  UNCOLLECTIBLE = 'UNCOLLECTIBLE',
}

export enum WebhookProcessingStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

export enum SubscriptionPlanChangeAction {
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
}

export enum PlanChangeDirection {
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
  LATERAL = 'lateral',
  SAME = 'same',
}

export enum CouponDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum CouponDuration {
  ONCE = 'ONCE',
  REPEATING = 'REPEATING',
  FOREVER = 'FOREVER',
}
