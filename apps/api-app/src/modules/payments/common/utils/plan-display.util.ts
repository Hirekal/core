/**
 * @fileoverview Helpers for customer-facing plan labels.
 */
import { PriceInterval } from '../enums/payment.enums';

/*
 * Returns a short billing period label such as "Monthly" or "Yearly".
 */
export function formatBillingPeriodLabel(
  interval: PriceInterval | null,
  intervalCount = 1,
): string | null {
  if (interval === PriceInterval.MONTH && intervalCount === 3) {
    return 'Quarterly';
  }
  if (interval === PriceInterval.MONTH && intervalCount === 1) {
    return 'Monthly';
  }
  if (interval === PriceInterval.YEAR) {
    return 'Yearly';
  }
  if (interval === PriceInterval.WEEK) {
    return 'Weekly';
  }
  if (interval === PriceInterval.DAY) {
    return 'Daily';
  }
  if (interval === PriceInterval.ONE_TIME) {
    return 'One-time';
  }
  return null;
}

/*
 * Removes a trailing billing period suffix already embedded in a product name.
 */
export function normalizeProductName(productName: string): string {
  return productName
    .replace(/\s+(Monthly|Quarterly|Yearly)$/i, '')
    .trim();
}

/*
 * Builds a plan label such as "Professional · Yearly".
 */
export function formatPlanDisplayName(
  productName: string,
  interval: PriceInterval | null,
  intervalCount = 1,
): string {
  const normalizedName = normalizeProductName(productName);
  const period = formatBillingPeriodLabel(interval, intervalCount);
  return period ? `${normalizedName} · ${period}` : normalizedName;
}
