/**
 * @fileoverview Formatting helpers for billing UI.
 */
import type { Price, PriceInterval, Subscription, SubscriptionStatus } from '../types/billing';

const BILLABLE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
];

/**
 * Returns true when the subscription can be managed or changed on a plan.
 */
export function isBillableSubscription(
  subscription: Subscription | null | undefined,
): subscription is Subscription {
  if (!subscription) {
    return false;
  }

  return BILLABLE_SUBSCRIPTION_STATUSES.includes(subscription.subscriptionStatus);
}

/**
 * Returns the local price ID for a pending scheduled plan change when set.
 */
export function getScheduledPlanPriceId(
  subscription: Subscription | null | undefined,
): string | null {
  const priceId = subscription?.metadata?.pendingDowngradePriceId;
  return typeof priceId === 'string' && priceId.length > 0 ? priceId : null;
}

/**
 * Returns when a scheduled plan change should take effect.
 */
export function getScheduledPlanChangeAt(
  subscription: Subscription | null | undefined,
): string | null {
  const scheduledAt = subscription?.metadata?.scheduledPlanChangeAt;
  if (typeof scheduledAt === 'string' && scheduledAt.length > 0) {
    return scheduledAt;
  }
  return subscription?.currentPeriodEnd ?? null;
}

/**
 * Formats a major-unit amount with currency symbol.
 */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Returns a human-readable billing interval label.
 */
export function formatInterval(interval: PriceInterval | null, count = 1): string {
  if (!interval || interval === 'ONE_TIME') {
    return 'One-time';
  }
  const labels: Record<PriceInterval, string> = {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year',
    ONE_TIME: 'one-time',
  };
  const unit = labels[interval];
  if (count === 1) {
    return `Per ${unit}`;
  }
  return `Every ${count} ${unit}s`;
}

/**
 * Returns display interval shorthand such as "Monthly".
 */
export function formatIntervalShort(interval: PriceInterval | null): string {
  if (interval === 'MONTH') return 'Monthly';
  if (interval === 'YEAR') return 'Yearly';
  if (interval === 'WEEK') return 'Weekly';
  if (interval === 'DAY') return 'Daily';
  if (interval === 'ONE_TIME') return 'One-time';
  return '—';
}

/**
 * Extracts feature list from product metadata.
 */
export function getProductFeatures(metadata: Record<string, unknown> | null): string[] {
  if (!metadata || !Array.isArray(metadata.features)) {
    return [];
  }
  return metadata.features.filter((item): item is string => typeof item === 'string');
}

/**
 * Reads recommended flag from product metadata.
 */
export function isProductRecommended(metadata: Record<string, unknown> | null): boolean {
  return metadata?.recommended === true;
}

/**
 * Reads sort order from product metadata with a high default.
 */
export function getProductSortOrder(metadata: Record<string, unknown> | null): number {
  const value = metadata?.sortOrder;
  return typeof value === 'number' ? value : 999;
}

/**
 * Compares two prices for upgrade/downgrade direction using amount.
 */
export function comparePriceTier(current: Price, next: Price): 'upgrade' | 'downgrade' | 'same' {
  if (next.amount > current.amount) return 'upgrade';
  if (next.amount < current.amount) return 'downgrade';
  return 'same';
}

/**
 * Maps subscription status to Badge status prop.
 */
export function subscriptionBadgeStatus(
  status: string,
): 'active' | 'paused' | 'archived' | 'success' | 'failed' | 'default' {
  if (status === 'ACTIVE' || status === 'TRIALING') return 'active';
  if (status === 'PAST_DUE' || status === 'UNPAID' || status === 'INCOMPLETE') return 'failed';
  if (status === 'CANCELED') return 'archived';
  return 'default';
}

/**
 * Maps invoice status to Badge status prop.
 */
export function invoiceBadgeStatus(
  status: string,
): 'active' | 'paused' | 'archived' | 'success' | 'failed' | 'default' {
  if (status === 'PAID') return 'success';
  if (status === 'OPEN') return 'active';
  if (status === 'VOID' || status === 'UNCOLLECTIBLE') return 'failed';
  return 'default';
}
