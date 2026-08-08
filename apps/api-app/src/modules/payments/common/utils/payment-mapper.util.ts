/**
 * @fileoverview Stripe-to-domain status and value mapping helpers.
 */
import {
  InvoiceStatus,
  PaymentMethodType,
  PaymentStatus,
  PriceInterval,
  SubscriptionStatus,
} from '../enums/payment.enums';
import { toDateFromUnix as toDateFromUnixTimestamp } from './date.util';

const STRIPE_SUBSCRIPTION_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: SubscriptionStatus.ACTIVE,
  trialing: SubscriptionStatus.TRIALING,
  past_due: SubscriptionStatus.PAST_DUE,
  canceled: SubscriptionStatus.CANCELED,
  unpaid: SubscriptionStatus.UNPAID,
  incomplete: SubscriptionStatus.INCOMPLETE,
  incomplete_expired: SubscriptionStatus.INCOMPLETE,
  paused: SubscriptionStatus.CANCELED,
};

const STRIPE_INVOICE_STATUS_MAP: Record<string, InvoiceStatus> = {
  draft: InvoiceStatus.DRAFT,
  open: InvoiceStatus.OPEN,
  paid: InvoiceStatus.PAID,
  void: InvoiceStatus.VOID,
  uncollectible: InvoiceStatus.UNCOLLECTIBLE,
};

const STRIPE_PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  requires_payment_method: PaymentStatus.PENDING,
  requires_confirmation: PaymentStatus.PENDING,
  requires_action: PaymentStatus.PENDING,
  processing: PaymentStatus.PENDING,
  succeeded: PaymentStatus.SUCCESS,
  canceled: PaymentStatus.FAILED,
  failed: PaymentStatus.FAILED,
};

const STRIPE_INTERVAL_MAP: Record<string, PriceInterval> = {
  day: PriceInterval.DAY,
  week: PriceInterval.WEEK,
  month: PriceInterval.MONTH,
  year: PriceInterval.YEAR,
};

/*
 * Maps Stripe subscription status to local SubscriptionStatus enum.
 */
export function mapStripeSubscriptionStatus(
  status: string,
): SubscriptionStatus {
  return (
    STRIPE_SUBSCRIPTION_STATUS_MAP[status] ?? SubscriptionStatus.INCOMPLETE
  );
}

/*
 * Maps Stripe invoice status to local InvoiceStatus enum.
 */
export function mapStripeInvoiceStatus(status: string): InvoiceStatus {
  return STRIPE_INVOICE_STATUS_MAP[status] ?? InvoiceStatus.DRAFT;
}

/*
 * Maps Stripe payment intent status to local PaymentStatus enum.
 */
export function mapStripePaymentStatus(status: string): PaymentStatus {
  return STRIPE_PAYMENT_STATUS_MAP[status] ?? PaymentStatus.PENDING;
}

/*
 * Map Stripe Interval.
 */
export function mapStripeInterval(
  interval: string | null,
): PriceInterval | null {
  if (!interval) {
    return PriceInterval.ONE_TIME;
  }
  return STRIPE_INTERVAL_MAP[interval] ?? null;
}

/*
 * Maps Stripe payment method type to local enum.
 */
export function mapStripePaymentMethodType(type: string): PaymentMethodType {
  switch (type) {
    case 'card':
      return PaymentMethodType.CARD;
    case 'upi':
      return PaymentMethodType.UPI;
    case 'us_bank_account':
    case 'bank_account':
      return PaymentMethodType.BANK_ACCOUNT;
    default:
      return PaymentMethodType.WALLET;
  }
}

/*
 * Converts a Unix timestamp to a JavaScript Date.
 */
export function toDateFromUnix(value: number | null | undefined): Date | null {
  return toDateFromUnixTimestamp(value);
}

/*
 * Extracts string ID from a Stripe string-or-object reference.
 */
export function resolveStripeResourceId(
  value: string | { id: string } | null | undefined,
): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return value.id;
}
