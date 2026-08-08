/**
 * @fileoverview Converts amounts between API major units and provider minor units.
 * API catalog amounts (prices) use major units as integers (e.g. 79 = $79).
 * Invoice/payment rows store provider minor units (e.g. 11998 = $119.98).
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

/**
 * Returns the multiplier for a currency (100 for USD/INR, 1 for JPY, etc.).
 */
export function getCurrencyMultiplier(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

/**
 * Converts a major-unit API amount to provider minor units.
 */
export function toProviderMinorAmount(
  majorAmount: number,
  currency: string,
): number {
  return Math.round(majorAmount * getCurrencyMultiplier(currency));
}

/**
 * Converts provider minor units to major-unit API amounts.
 */
export function toMajorAmount(minorAmount: number, currency: string): number {
  const multiplier = getCurrencyMultiplier(currency);
  return multiplier === 1 ? minorAmount : minorAmount / multiplier;
}
