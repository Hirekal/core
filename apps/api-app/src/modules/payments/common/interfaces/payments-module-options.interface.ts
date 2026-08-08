/**
 * @fileoverview TypeScript interfaces for payments module options.
 */
export const PAYMENTS_MODULE_OPTIONS = 'PAYMENTS_MODULE_OPTIONS';

export interface StripeModuleConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentsModuleOptions {
  defaultProviderCode: string;
  stripe?: StripeModuleConfig;
}
