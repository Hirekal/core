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
  UpgradeCheckoutSessionResponse,
  ValidatedCoupon,
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
  couponCode?: string,
): Promise<PlanChangePreview> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/subscriptions/${subscriptionId}/plan-change/preview`, {
      method: 'POST',
      auth: true,
      body: {
        priceId,
        ...(couponCode ? { couponCode } : {}),
      },
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
 * Cached in-memory for the session to avoid repeat config round-trips.
 */
let checkoutConfigPromise: Promise<{ publishableKey: string }> | null = null;
let stripeRuntimePromise: Promise<unknown> | null = null;

export async function getCheckoutConfig(): Promise<{ publishableKey: string }> {
  if (!checkoutConfigPromise) {
    checkoutConfigPromise = withBillingErrorHandling(() =>
      apiRequest('/payments/checkout/config', { auth: true }),
    ).catch((error) => {
      checkoutConfigPromise = null;
      throw error;
    });
  }
  return checkoutConfigPromise;
}

/*
 * Warms checkout config + Stripe.js so payment UI mounts faster.
 */
export function warmCheckoutRuntime(): Promise<unknown> {
  if (!stripeRuntimePromise) {
    stripeRuntimePromise = getCheckoutConfig()
      .then(async (config) => {
        if (!config.publishableKey) {
          return null;
        }
        const { loadStripe } = await import('@stripe/stripe-js');
        return loadStripe(config.publishableKey);
      })
      .catch((error) => {
        stripeRuntimePromise = null;
        throw error;
      });
  }
  return stripeRuntimePromise;
}

/*
 * Creates a prorated upgrade checkout session for card payment.
 */
export async function createUpgradeCheckoutSession(
  subscriptionId: string,
  priceId: string,
  couponCode?: string,
): Promise<UpgradeCheckoutSessionResponse> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/subscriptions/${subscriptionId}/upgrade/checkout`, {
      method: 'POST',
      auth: true,
      body: {
        priceId,
        ...(couponCode ? { couponCode } : {}),
      },
    }),
  );
}

/*
 * Reverts an unpaid upgrade checkout after card confirmation fails.
 */
export async function cancelPendingUpgradeCheckout(
  subscriptionId: string,
): Promise<Subscription> {
  return withBillingErrorHandling(() =>
    apiRequest(`/payments/subscriptions/${subscriptionId}/upgrade/checkout/cancel`, {
      method: 'POST',
      auth: true,
    }),
  );
}

/*
 * Creates a checkout payment intent via the backend.
 */
export async function createCheckoutSession(input: {
  priceId: string;
  email: string;
  name?: string;
  couponCode?: string;
  previousProviderSubscriptionId?: string;
}): Promise<CheckoutSessionResponse> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/checkout', {
      method: 'POST',
      auth: true,
      body: input,
    }),
  );
}

type SubscribeCheckoutPrefetch = {
  price: Price | null;
  sessionPromise: Promise<CheckoutSessionResponse>;
  siblingPricesPromise: Promise<Price[]>;
};

type UpgradeCheckoutPrefetch = {
  price: Price | null;
  subscriptionId: string;
  currentProductName: string | null;
  previewPromise: ReturnType<typeof previewPlanChange>;
  siblingPricesPromise: Promise<Price[]>;
  configPromise: ReturnType<typeof getCheckoutConfig>;
};

const subscribeCheckoutPrefetch = new Map<string, SubscribeCheckoutPrefetch>();
const upgradeCheckoutPrefetch = new Map<string, UpgradeCheckoutPrefetch>();

function subscribePrefetchKey(priceId: string, email: string): string {
  return `${priceId}:${email.trim().toLowerCase()}`;
}

function upgradePrefetchKey(subscriptionId: string, priceId: string): string {
  return `${subscriptionId}:${priceId}`;
}

/*
 * Starts subscribe checkout work as soon as the user clicks Subscribe.
 */
export function prefetchSubscribeCheckout(input: {
  priceId: string;
  email: string;
  name?: string;
  price?: Price;
}): SubscribeCheckoutPrefetch {
  const key = subscribePrefetchKey(input.priceId, input.email);
  const existing = subscribeCheckoutPrefetch.get(key);
  if (existing) {
    return existing;
  }

  void warmCheckoutRuntime();

  const entry: SubscribeCheckoutPrefetch = {
    price: input.price ?? null,
    sessionPromise: createCheckoutSession({
      priceId: input.priceId,
      email: input.email,
      name: input.name,
    }),
    siblingPricesPromise: input.price
      ? getPrices(input.price.productId)
      : getPrice(input.priceId).then((price) => getPrices(price.productId)),
  };

  subscribeCheckoutPrefetch.set(key, entry);
  return entry;
}

/*
 * Reads a subscribe checkout prefetch started from the plans page.
 */
export function takeSubscribeCheckoutPrefetch(
  priceId: string,
  email: string,
): SubscribeCheckoutPrefetch | null {
  return subscribeCheckoutPrefetch.get(subscribePrefetchKey(priceId, email)) ?? null;
}

/*
 * Clears a consumed subscribe checkout prefetch entry.
 */
export function clearSubscribeCheckoutPrefetch(
  priceId: string,
  email: string,
): void {
  subscribeCheckoutPrefetch.delete(subscribePrefetchKey(priceId, email));
}

/*
 * Starts upgrade preview work as soon as the user confirms Upgrade.
 */
export function prefetchUpgradeCheckout(input: {
  subscriptionId: string;
  priceId: string;
  price?: Price;
  currentProductName?: string | null;
}): UpgradeCheckoutPrefetch {
  const key = upgradePrefetchKey(input.subscriptionId, input.priceId);
  const existing = upgradeCheckoutPrefetch.get(key);
  if (existing) {
    return existing;
  }

  void warmCheckoutRuntime();

  const entry: UpgradeCheckoutPrefetch = {
    price: input.price ?? null,
    subscriptionId: input.subscriptionId,
    currentProductName: input.currentProductName ?? null,
    previewPromise: previewPlanChange(input.subscriptionId, input.priceId),
    siblingPricesPromise: input.price
      ? getPrices(input.price.productId)
      : getPrice(input.priceId).then((price) => getPrices(price.productId)),
    configPromise: getCheckoutConfig(),
  };

  upgradeCheckoutPrefetch.set(key, entry);
  return entry;
}

/*
 * Reads an upgrade checkout prefetch started from the plans page.
 */
export function takeUpgradeCheckoutPrefetch(
  subscriptionId: string,
  priceId: string,
): UpgradeCheckoutPrefetch | null {
  return (
    upgradeCheckoutPrefetch.get(upgradePrefetchKey(subscriptionId, priceId)) ??
    null
  );
}

/*
 * Clears a consumed upgrade checkout prefetch entry.
 */
export function clearUpgradeCheckoutPrefetch(
  subscriptionId: string,
  priceId: string,
): void {
  upgradeCheckoutPrefetch.delete(upgradePrefetchKey(subscriptionId, priceId));
}

/*
 * Validates a promotion / coupon code against the catalog.
 */
export async function validateCoupon(
  promotionCode: string,
): Promise<ValidatedCoupon> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/coupons/validate', {
      method: 'POST',
      auth: true,
      body: { promotionCode },
    }),
  );
}

/*
 * Syncs the local subscription after custom checkout payment succeeds.
 */
export async function syncCheckoutSubscription(
  providerSubscriptionId: string,
  providerPaymentId?: string,
): Promise<Subscription | null> {
  return withBillingErrorHandling(() =>
    apiRequest('/payments/checkout/sync', {
      method: 'POST',
      auth: true,
      body: { providerSubscriptionId, providerPaymentId },
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
