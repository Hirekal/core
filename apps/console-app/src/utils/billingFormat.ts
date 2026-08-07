/**
 * @fileoverview Formatting helpers for billing UI.
 */
import type { Price, PriceInterval, Subscription, SubscriptionStatus } from '../types/billing';

export type BillingPeriod = 'monthly' | 'quarterly' | 'yearly';

const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'yearly'];

export function getBillingPeriodLabel(period: BillingPeriod): string {
  return BILLING_PERIOD_LABELS[period];
}

export function resolveBillingPeriod(
  interval: PriceInterval | null,
  intervalCount: number | null = 1,
): BillingPeriod | null {
  const count = intervalCount ?? 1;
  if (interval === 'MONTH' && count === 1) return 'monthly';
  if (interval === 'MONTH' && count === 3) return 'quarterly';
  if (interval === 'YEAR' && count === 1) return 'yearly';
  return null;
}

export function matchesBillingPeriod(
  price: Pick<Price, 'interval' | 'intervalCount'>,
  period: BillingPeriod,
): boolean {
  return resolveBillingPeriod(price.interval, price.intervalCount) === period;
}

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
export function formatIntervalShort(
  interval: PriceInterval | null,
  intervalCount = 1,
): string {
  if (interval === 'MONTH' && intervalCount === 3) return 'Quarterly';
  if (interval === 'MONTH' && intervalCount === 1) return 'Monthly';
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
 * Converts a recurring price into a comparable monthly amount.
 */
export function normalizeMonthlyAmount(
  price: Pick<Price, 'amount' | 'interval' | 'intervalCount'>,
): number {
  const count = price.intervalCount ?? 1;
  let months = Number.NaN;

  if (price.interval === 'MONTH') {
    months = count;
  } else if (price.interval === 'YEAR') {
    months = count * 12;
  } else if (price.interval === 'WEEK') {
    months = (count * 7) / 30.4375;
  } else if (price.interval === 'DAY') {
    months = count / 30.4375;
  }

  if (!Number.isFinite(months) || months <= 0) {
    return Number.NaN;
  }

  return price.amount / months;
}

/**
 * Percent saved vs paying the monthly price for the same commitment length.
 * Returns null when monthly baseline is missing or there is no positive savings.
 */
export function getPeriodSavingsPercent(
  periodPrice: Pick<Price, 'amount' | 'interval' | 'intervalCount'>,
  monthlyPrice: Pick<Price, 'amount' | 'interval' | 'intervalCount'>,
): number | null {
  const monthlyNormalized = normalizeMonthlyAmount(monthlyPrice);
  const periodNormalized = normalizeMonthlyAmount(periodPrice);

  if (
    !Number.isFinite(monthlyNormalized) ||
    !Number.isFinite(periodNormalized) ||
    monthlyNormalized <= 0 ||
    periodNormalized >= monthlyNormalized
  ) {
    return null;
  }

  const percent = Math.round(
    ((monthlyNormalized - periodNormalized) / monthlyNormalized) * 100,
  );
  return percent > 0 ? percent : null;
}

/**
 * Builds period → savings% from a product's prices, compared to its monthly price.
 * When multiple products are passed (plans catalog), uses the lowest savings
 * for each period so the badge never overclaims.
 */
export function buildPeriodSavingsMap(
  prices: Array<Pick<Price, 'amount' | 'interval' | 'intervalCount' | 'productId'>>,
): Partial<Record<BillingPeriod, number>> {
  const byProduct = new Map<string, typeof prices>();
  for (const price of prices) {
    const key = price.productId || '__single__';
    const list = byProduct.get(key) ?? [];
    list.push(price);
    byProduct.set(key, list);
  }

  const savingsByPeriod: Partial<Record<BillingPeriod, number[]>> = {};

  for (const productPrices of byProduct.values()) {
    const monthly = productPrices.find((price) =>
      matchesBillingPeriod(price, 'monthly'),
    );
    if (!monthly) {
      continue;
    }

    for (const period of BILLING_PERIODS) {
      if (period === 'monthly') {
        continue;
      }
      const periodPrice = productPrices.find((price) =>
        matchesBillingPeriod(price, period),
      );
      if (!periodPrice) {
        continue;
      }
      const savings = getPeriodSavingsPercent(periodPrice, monthly);
      if (savings == null) {
        continue;
      }
      const list = savingsByPeriod[period] ?? [];
      list.push(savings);
      savingsByPeriod[period] = list;
    }
  }

  const result: Partial<Record<BillingPeriod, number>> = {};
  for (const period of BILLING_PERIODS) {
    const values = savingsByPeriod[period];
    if (!values?.length) {
      continue;
    }
    result[period] = Math.min(...values);
  }
  return result;
}

/**
 * Returns the billing period length in months for ranking commitment length.
 */
function intervalToMonths(
  interval: PriceInterval | null,
  intervalCount: number | null = 1,
): number {
  const count = intervalCount ?? 1;
  if (interval === 'MONTH') return count;
  if (interval === 'YEAR') return count * 12;
  if (interval === 'WEEK') return (count * 7) / 30.4375;
  if (interval === 'DAY') return count / 30.4375;
  return Number.NaN;
}

/**
 * Compares two prices for upgrade/downgrade direction.
 *
 * Same-product period changes use commitment length (quarterly → yearly is an
 * upgrade even when yearly is cheaper per month). Cross-product changes use
 * normalized monthly amount.
 */
export function comparePlanDirection(
  current: Pick<Price, 'id' | 'amount' | 'interval' | 'intervalCount' | 'productId'>,
  next: Pick<Price, 'id' | 'amount' | 'interval' | 'intervalCount' | 'productId'>,
): 'upgrade' | 'downgrade' | 'lateral' | 'same' {
  if (current.id === next.id) {
    return 'same';
  }

  const sameProduct =
    Boolean(current.productId) &&
    Boolean(next.productId) &&
    current.productId === next.productId;

  if (sameProduct) {
    const currentMonths = intervalToMonths(current.interval, current.intervalCount);
    const nextMonths = intervalToMonths(next.interval, next.intervalCount);

    if (
      Number.isFinite(currentMonths) &&
      Number.isFinite(nextMonths) &&
      currentMonths !== nextMonths
    ) {
      return nextMonths > currentMonths ? 'upgrade' : 'downgrade';
    }
  }

  const currentNormalized = normalizeMonthlyAmount(current);
  const nextNormalized = normalizeMonthlyAmount(next);

  if (!Number.isFinite(currentNormalized) || !Number.isFinite(nextNormalized)) {
    return 'lateral';
  }

  if (nextNormalized > currentNormalized) {
    return 'upgrade';
  }
  if (nextNormalized < currentNormalized) {
    return 'downgrade';
  }
  return 'lateral';
}

/**
 * Returns true when two prices use different billing intervals or cadences.
 */
export function isBillingIntervalChange(
  current: Pick<Price, 'interval' | 'intervalCount'>,
  next: Pick<Price, 'interval' | 'intervalCount'>,
): boolean {
  return (
    current.interval !== next.interval ||
    (current.intervalCount ?? 1) !== (next.intervalCount ?? 1)
  );
}

/**
 * Returns true when a target price is a valid upgrade-checkout period option.
 *
 * Hides downgrades and interval switches that would settle underpaid ($0 due)
 * because unused-time credit covers the new period charge.
 */
export function isPayableUpgradePeriod(
  current: Pick<Price, 'id' | 'amount' | 'interval' | 'intervalCount' | 'productId'>,
  next: Pick<Price, 'id' | 'amount' | 'interval' | 'intervalCount' | 'productId'>,
  unusedCreditEstimate = 0,
): boolean {
  const direction = comparePlanDirection(current, next);
  if (direction !== 'upgrade' && direction !== 'lateral') {
    return false;
  }

  if (!isBillingIntervalChange(current, next)) {
    return true;
  }

  const credit = Math.max(unusedCreditEstimate, 0);
  // Interval resets invoice the new period minus unused credit. If credit covers
  // the new period, Stripe settles $0 / underpaid — treat as unavailable here.
  return next.amount > credit;
}

/**
 * Compares two prices for upgrade/downgrade direction.
 * Prefer comparePlanDirection; this maps lateral to same for simple CTAs.
 */
export function comparePriceTier(current: Price, next: Price): 'upgrade' | 'downgrade' | 'same' {
  const direction = comparePlanDirection(current, next);
  if (direction === 'upgrade') return 'upgrade';
  if (direction === 'downgrade') return 'downgrade';
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
