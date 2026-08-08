/**
 * @fileoverview Persists billing session identifiers in localStorage.
 */
import type { BillingSession } from '../types/billing';

const BILLING_KEY = 'hirekal_billing';

/**
 * Reads the stored billing session for the current browser.
 */
export function readBillingSession(): BillingSession {
  try {
    const raw = localStorage.getItem(BILLING_KEY);
    if (!raw) {
      return { subscriptionId: null, paymentProviderId: null, customerId: null };
    }
    const parsed = JSON.parse(raw) as BillingSession;
    return {
      subscriptionId: parsed.subscriptionId ?? null,
      paymentProviderId: parsed.paymentProviderId ?? null,
      customerId: parsed.customerId ?? null,
    };
  } catch {
    return { subscriptionId: null, paymentProviderId: null, customerId: null };
  }
}

/**
 * Updates the billing session in localStorage.
 */
export function writeBillingSession(session: BillingSession): void {
  localStorage.setItem(BILLING_KEY, JSON.stringify(session));
}

/**
 * Clears subscription identifiers from the billing session.
 */
export function clearBillingSession(): void {
  localStorage.removeItem(BILLING_KEY);
}

/**
 * Stores subscription and provider identifiers after a successful checkout.
 */
export function persistSubscriptionSession(
  subscriptionId: string,
  paymentProviderId: string,
  customerId: string,
): void {
  writeBillingSession({ subscriptionId, paymentProviderId, customerId });
}
