/**
 * @fileoverview TypeScript types for billing and subscription APIs.
 */

export type RecordStatus = 'ACTIVE' | 'INACTIVE';

export type PriceInterval = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ONE_TIME';

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'INCOMPLETE';

export type InvoiceStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PAID'
  | 'VOID'
  | 'UNCOLLECTIBLE';

export interface PaymentProvider {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: RecordStatus;
  metadata: Record<string, unknown> | null;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: RecordStatus;
  metadata: Record<string, unknown> | null;
}

export interface Price {
  id: string;
  productId: string;
  paymentProviderId: string;
  providerPriceId: string;
  currency: string;
  amount: number;
  interval: PriceInterval | null;
  intervalCount: number | null;
  status: RecordStatus;
  metadata: Record<string, unknown> | null;
  product?: Product;
  paymentProvider?: PaymentProvider;
}

export interface PaymentCustomer {
  id: string;
  organizationId: string;
  paymentProviderId: string;
  providerCustomerId: string;
  email: string;
  name: string | null;
  status: RecordStatus;
  metadata: Record<string, unknown> | null;
  paymentProvider?: PaymentProvider;
}

export interface PaymentMethod {
  id: string;
  organizationId: string;
  customerId: string;
  paymentProviderId: string;
  providerPaymentMethodId: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  status: RecordStatus;
}

export interface Subscription {
  id: string;
  organizationId: string;
  customerId: string;
  priceId: string;
  paymentProviderId: string;
  providerSubscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  status: RecordStatus;
  metadata: Record<string, unknown> | null;
  customer?: PaymentCustomer;
  price?: Price;
  paymentProvider?: PaymentProvider;
}

export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId: string | null;
  paymentProviderId: string;
  providerInvoiceId: string;
  planName: string | null;
  invoiceNumber: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  invoiceStatus: InvoiceStatus;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  receiptUrl: string | null;
  paidAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface BillingPlan {
  product: Product;
  price: Price;
  features: string[];
  recommended: boolean;
  sortOrder: number;
}

export interface BillingSession {
  subscriptionId: string | null;
  paymentProviderId: string | null;
  customerId: string | null;
}

export interface PlanChangePreview {
  currentPlan: Price;
  newPlan: Price;
  direction: 'upgrade' | 'downgrade' | 'lateral' | 'same';
  preview: {
    currency: string;
    prorationCredit: number;
    prorationCharge: number;
    netProrationAmount: number;
    estimatedAmountPayable: number;
    currentPeriodEnd: string;
  };
}

export interface CheckoutSessionResponse {
  clientSecret: string;
  sessionId: string;
  providerSubscriptionId: string;
  publishableKey: string;
}

export interface UpgradeCheckoutSessionResponse extends CheckoutSessionResponse {
  amountDue: number;
  currency: string;
}

export interface CheckoutSessionStatusResponse {
  sessionId: string;
  status: string | null;
  subscription: Subscription | null;
}
