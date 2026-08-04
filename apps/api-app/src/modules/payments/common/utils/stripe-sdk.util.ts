/**
 * @fileoverview Stripe SDK import helpers for CommonJS / ESM interop.
 */
import StripeImport from 'stripe';

type StripeConstructor = typeof StripeImport;
type StripeInstance = InstanceType<StripeConstructor>;
type StripeErrorsNamespace = StripeConstructor['errors'];

/**
 * Resolves the Stripe constructor across module interop shapes.
 */
export function resolveStripeConstructor(): StripeConstructor {
  const imported: unknown = StripeImport;

  if (typeof imported === 'function') {
    return imported as StripeConstructor;
  }

  const withDefault = imported as { default?: StripeConstructor };
  if (withDefault.default && typeof withDefault.default === 'function') {
    return withDefault.default;
  }

  throw new Error('Stripe SDK constructor is unavailable');
}

/**
 * Returns the Stripe errors namespace when the SDK loaded correctly.
 */
export function getStripeErrorsNamespace(): StripeErrorsNamespace | null {
  try {
    const StripeCtor = resolveStripeConstructor();
    return StripeCtor.errors ?? null;
  } catch {
    return null;
  }
}

/**
 * Creates a configured Stripe client instance.
 */
export function createStripeClient(secretKey: string): StripeInstance {
  const StripeCtor = resolveStripeConstructor();
  return new StripeCtor(secretKey);
}

export type Stripe = StripeInstance;
