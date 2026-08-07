/**
 * @fileoverview Provider-independent subscription plan comparison helpers.
 */
import { PlanChangeDirection, PriceInterval } from '../enums/payment.enums';

export { PlanChangeDirection };

export interface PlanComparablePrice {
  id: string;
  amount: number;
  currency: string;
  interval: PriceInterval | null;
  intervalCount: number | null;
  paymentProviderId: string;
  productId?: string;
}

const DAYS_PER_MONTH = 30.4375;

function intervalToMonths(
  interval: PriceInterval | null,
  intervalCount: number | null,
): number {
  const count = intervalCount ?? 1;
  switch (interval) {
    case PriceInterval.DAY:
      return count / DAYS_PER_MONTH;
    case PriceInterval.WEEK:
      return (count * 7) / DAYS_PER_MONTH;
    case PriceInterval.MONTH:
      return count;
    case PriceInterval.YEAR:
      return count * 12;
    case PriceInterval.ONE_TIME:
    default:
      return Number.NaN;
  }
}

/*
 * Converts a recurring price into a comparable monthly amount so plans with
 * different intervals (monthly vs yearly) can be ranked consistently.
 */
export function normalizePlanAmount(price: PlanComparablePrice): number {
  const months = intervalToMonths(price.interval, price.intervalCount);
  if (!Number.isFinite(months) || months <= 0) {
    return Number.NaN;
  }
  return price.amount / months;
}

/*
 * Compares two prices and returns upgrade, downgrade, lateral, or same direction.
 *
 * Same-product billing-period changes use commitment length (quarterly → yearly
 * is an upgrade even when the yearly plan is cheaper per month). Cross-product
 * changes use normalized monthly amount.
 */
export function comparePlans(
  current: PlanComparablePrice,
  target: PlanComparablePrice,
): PlanChangeDirection {
  if (current.id === target.id) {
    return PlanChangeDirection.SAME;
  }

  const sameProduct =
    Boolean(current.productId) &&
    Boolean(target.productId) &&
    current.productId === target.productId;

  if (sameProduct) {
    const currentMonths = intervalToMonths(
      current.interval,
      current.intervalCount,
    );
    const targetMonths = intervalToMonths(target.interval, target.intervalCount);

    if (
      Number.isFinite(currentMonths) &&
      Number.isFinite(targetMonths) &&
      currentMonths !== targetMonths
    ) {
      return targetMonths > currentMonths
        ? PlanChangeDirection.UPGRADE
        : PlanChangeDirection.DOWNGRADE;
    }
  }

  const currentNormalized = normalizePlanAmount(current);
  const targetNormalized = normalizePlanAmount(target);

  if (
    !Number.isFinite(currentNormalized) ||
    !Number.isFinite(targetNormalized)
  ) {
    return PlanChangeDirection.LATERAL;
  }

  if (targetNormalized > currentNormalized) {
    return PlanChangeDirection.UPGRADE;
  }
  if (targetNormalized < currentNormalized) {
    return PlanChangeDirection.DOWNGRADE;
  }
  return PlanChangeDirection.LATERAL;
}

/*
 * Returns true when a plan change should apply immediately (upgrade/lateral).
 */
export function isImmediatePlanChange(direction: PlanChangeDirection): boolean {
  return (
    direction === PlanChangeDirection.UPGRADE ||
    direction === PlanChangeDirection.LATERAL
  );
}
