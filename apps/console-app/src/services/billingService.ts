/**
 * @fileoverview Billing and subscription API client.
 */
import { apiRequest } from './apiClient';
import type {
  BillingPlan,
  CheckoutSessionResponse,
  CheckoutSessionStatusResponse,
  Invoice,
  PaymentCustomer,
  PaymentMethod,
  PaymentProvider,
  PlanChangePreview,
  Price,
  Product,
  Subscription,
} from '../types/billing';
import {
  getProductFeatures,
  getProductSortOrder,
  isProductRecommended,
} from '../utils/billingFormat';

/*
 * Unwraps API responses that nest payload under a data property.
 */
function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

/*
 * Wraps billing API calls with consistent error propagation.
 */
async function withBillingErrorHandling<T>(
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    throw error;
  }
}

/*
 * Lists configured payment providers.
 */
export async function getPaymentProviders(): Promise<PaymentProvider[]> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/providers', { auth: true }),
  );
}

/*
 * Returns the default Stripe provider or the first available provider.
 */
export async function getDefaultPaymentProvider(): Promise<PaymentProvider> {
  return withBillingErrorHandling(async () => {
    const providers = await getPaymentProviders();
    const stripe = providers.find((provider) => provider.code === 'STRIPE');
    if (stripe) return stripe;
    if (!providers[0]) {
      throw new Error('No payment providers configured');
    }
    return providers[0];
  });
}

/*
 * Lists catalog products.
 */
export async function getProducts(): Promise<Product[]> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/products', { auth: true }),
  );
}

/*
 * Lists prices optionally filtered by product.
 */
export async function getPrices(productId?: string): Promise<Price[]> {
  return withBillingErrorHandling(() => {
    const query = productId ? `?productId=${productId}` : '';
    return apiRequest(`/payments/prices${query}`, { auth: true });
  });
}

/*
 * Loads products with their active prices as billing plans.
 */
export async function getBillingPlans(): Promise<BillingPlan[]> {
  return withBillingErrorHandling(async () => {
    const [products, prices] = await Promise.all([getProducts(), getPrices()]);
    const activeProducts = products.filter((product) => product.status === 'ACTIVE');
    const activePrices = prices.filter((price) => price.status === 'ACTIVE');

    const plans: BillingPlan[] = [];
    for (const product of activeProducts) {
      const productPrices = activePrices.filter((price) => price.productId === product.id);
      for (const price of productPrices) {
        plans.push({
          product,
          price: { ...price, product },
          features: getProductFeatures(product.metadata),
          recommended: isProductRecommended(product.metadata),
          sortOrder: getProductSortOrder(product.metadata),
        });
      }
    }

    return plans.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.price.amount - b.price.amount,
    );
  });
}

/*
 * Fetches a single price by internal ID.
 */
export async function getPrice(priceId: string): Promise<Price> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/prices/${priceId}`, { auth: true }),
  );
}

/*
 * Returns the authenticated user's payment customer for a provider.
 */
export async function getMyPaymentCustomer(
  paymentProviderId: string,
): Promise<PaymentCustomer | null> {
  try {
    return await apiRequest(
      `/payments/customers/me?paymentProviderId=${paymentProviderId}`,
      { auth: true },
    );
  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 404) return null;
    throw error;
  }
}

/*
 * Creates a payment provider customer for the authenticated user.
 */
export async function createPaymentCustomer(input: {
  paymentProviderId: string;
  email: string;
  name?: string;
}): Promise<PaymentCustomer> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/customers', {
      method: 'POST',
      auth: true,
      body: input,
    }),
  );
}

/*
 * Ensures a payment customer exists, creating one when missing.
 */
export async function ensurePaymentCustomer(input: {
  paymentProviderId: string;
  email: string;
  name?: string;
}): Promise<PaymentCustomer> {
  return withBillingErrorHandling(async () => {
    const existing = await getMyPaymentCustomer(input.paymentProviderId);
    if (existing) return existing;
    return createPaymentCustomer(input);
  });
}

/*
 * Attaches a Stripe payment method and sets it as default.
 */
export async function attachPaymentMethod(input: {
  paymentProviderId: string;
  providerPaymentMethodId: string;
}): Promise<PaymentMethod> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/payment-methods', {
      method: 'POST',
      auth: true,
      body: input,
    }),
  );
}

/*
 * Lists saved payment methods for a provider.
 */
export async function getPaymentMethods(
  paymentProviderId: string,
): Promise<PaymentMethod[]> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/payment-methods?paymentProviderId=${paymentProviderId}`, {
      auth: true,
    }),
  );
}

/*
 * Creates a subscription for a customer and price.
 */
export async function createSubscription(input: {
  customerId: string;
  priceId: string;
}): Promise<Subscription> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/subscriptions', {
      method: 'POST',
      auth: true,
      body: input,
    }),
  );
}

/*
 * Fetches the authenticated user's latest subscription when available.
 */
export async function getMySubscription(): Promise<Subscription | null> {
  return withBillingErrorHandling(async () => {
    const subscription = await apiRequest<Subscription | null>(
      '/payments/subscriptions/me',
      { auth: true },
    );
    return subscription ?? null;
  });
}

/*
 * Fetches a subscription by internal ID.
 */
export async function getSubscription(subscriptionId: string): Promise<Subscription> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/subscriptions/${subscriptionId}`, { auth: true }),
  );
}

/*
 * Cancels a subscription immediately or at period end.
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd = true,
): Promise<Subscription> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      auth: true,
      body: { cancelAtPeriodEnd },
    }),
  );
}

/*
 * Resumes a subscription scheduled to cancel at period end.
 */
export async function resumeSubscription(subscriptionId: string): Promise<Subscription> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/subscriptions/${subscriptionId}/resume`, {
      method: 'POST',
      auth: true,
    }),
  );
}

/*
 * Upgrades a subscription to a higher plan.
 */
export async function upgradeSubscription(
  subscriptionId: string,
  priceId: string,
): Promise<Subscription> {
  return withBillingErrorHandling(async () => {
    const response = await apiRequest(
      `/payments/subscriptions/${subscriptionId}/upgrade`,
      {
        method: 'POST',
        auth: true,
        body: { priceId },
      },
    );
    return unwrapData<Subscription>(response);
  });
}

/*
 * Schedules a downgrade at the next billing cycle.
 */
export async function downgradeSubscription(
  subscriptionId: string,
  priceId: string,
): Promise<Subscription> {
  return withBillingErrorHandling(async () => {
    const response = await apiRequest(
      `/payments/subscriptions/${subscriptionId}/downgrade`,
      {
        method: 'POST',
        auth: true,
        body: { priceId },
      },
    );
    return unwrapData<Subscription>(response);
  });
}

/*
 * Cancels a pending scheduled plan change.
 */
export async function cancelScheduledPlanChange(
  subscriptionId: string,
): Promise<Subscription> {
  return withBillingErrorHandling(async () => {
    const response = await apiRequest(
      `/payments/subscriptions/${subscriptionId}/cancel-scheduled-change`,
      { method: 'POST', auth: true },
    );
    return unwrapData<Subscription>(response);
  });
}

/*
 * Previews proration for an immediate plan change.
 */
export async function previewPlanChange(
  subscriptionId: string,
  priceId: string,
): Promise<PlanChangePreview> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/subscriptions/${subscriptionId}/plan-change/preview`, {
      method: 'POST',
      auth: true,
      body: { priceId },
    }),
  );
}

/*
 * Lists invoices for the authenticated user.
 */
export async function getMyInvoices(): Promise<Invoice[]> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/invoices/me', { auth: true }),
  );
}

/*
 * Lists invoices for the authenticated user and provider.
 */
export async function getInvoices(paymentProviderId: string): Promise<Invoice[]> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/invoices?paymentProviderId=${paymentProviderId}`, {
      auth: true,
    }),
  );
}

/*
 * Returns Stripe publishable key for embedded checkout.
 */
export async function getCheckoutConfig(): Promise<{ publishableKey: string }> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/checkout/config', { auth: true }),
  );
}

/*
 * Creates an embedded Stripe Checkout session via the backend.
 */
export async function createCheckoutSession(input: {
  priceId: string;
  email: string;
  name?: string;
  returnUrl?: string;
}): Promise<CheckoutSessionResponse> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/checkout', {
      method: 'POST',
      auth: true,
      body: input,
    }),
  );
}

/*
 * Opens Stripe Billing Portal so the user can update their default card.
 */
export async function createBillingPortalSession(input: {
  paymentProviderId: string;
  returnUrl?: string;
}): Promise<{ url: string }> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/billing-portal', {
      method: 'POST',
      auth: true,
      body: {
        paymentProviderId: input.paymentProviderId,
        returnUrl: input.returnUrl ?? `${window.location.origin}/billing/subscription`,
      },
    }),
  );
}

/*
 * Resolves checkout session status and linked subscription after payment.
 */
export async function getCheckoutSessionStatus(
  sessionId: string,
): Promise<CheckoutSessionStatusResponse> {
  return withBillingErrorHandling(() =>
    apiRequest(
      `/payments/checkout/session?session_id=${encodeURIComponent(sessionId)}`,
      { auth: true },
    ),
  );
}
