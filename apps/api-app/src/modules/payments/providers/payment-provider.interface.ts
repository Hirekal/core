/**
 * @fileoverview Payment provider abstraction interface and shared types.
 */
import {
  InvoiceStatus,
  PaymentMethodType,
  PaymentStatus,
  SubscriptionStatus,
} from '../common/enums/payment.enums';

export interface ProviderCustomerInput {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface ProviderCustomerResult {
  providerCustomerId: string;
}

export interface ProviderProductInput {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface ProviderProductResult {
  providerProductId: string;
}

export interface ProviderPriceInput {
  providerProductId: string;
  currency: string;
  amount: number;
  interval?: string;
  intervalCount?: number;
  metadata?: Record<string, string>;
}

export interface ProviderPriceResult {
  providerPriceId: string;
}

export interface ProviderSubscriptionInput {
  providerCustomerId: string;
  providerPriceId: string;
  metadata?: Record<string, string>;
}

export interface ProviderChangeSubscriptionPlanInput {
  providerSubscriptionId: string;
  providerCustomerId: string;
  providerPriceId: string;
  isUpgrade: boolean;
}

export interface ProviderScheduledPlanChange {
  providerScheduleId: string;
  pendingProviderPriceId: string;
  effectiveAt: Date;
}

export interface ProviderSubscriptionResult {
  providerSubscriptionId: string;
  providerCustomerId: string;
  providerPriceId: string;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  scheduledChange?: ProviderScheduledPlanChange | null;
}

export interface ProviderPlanChangePreviewInput {
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerPriceId: string;
}

export interface ProviderPlanChangePreviewResult {
  currency: string;
  currentProviderPriceId: string;
  newProviderPriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  prorationCredit: number;
  prorationCharge: number;
  netProrationAmount: number;
  estimatedAmountPayable: number;
  invoiceTotal: number;
  remainingPeriodSeconds: number;
}

export interface ProviderCheckoutSessionInput {
  providerCustomerId: string;
  providerPriceId: string;
  metadata?: Record<string, string>;
}

export interface ProviderCheckoutSessionResult {
  clientSecret: string;
  sessionId: string;
  providerSubscriptionId: string;
}

export interface ProviderBillingPortalSessionInput {
  providerCustomerId: string;
  returnUrl: string;
}

export interface ProviderBillingPortalSessionResult {
  url: string;
}

export interface ProviderPaymentMethodResult {
  providerPaymentMethodId: string;
  type: PaymentMethodType;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export interface ProviderInvoiceResult {
  providerInvoiceId: string;
  providerSubscriptionId: string | null;
  providerPaymentId: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  invoiceStatus: InvoiceStatus;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  paidAt: Date | null;
  planName?: string | null;
  receiptUrl?: string | null;
  invoiceNumber?: string | null;
}

export interface ProviderPaymentResult {
  providerPaymentId: string;
  providerCustomerId: string;
  providerSubscriptionId: string | null;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethodType | null;
  paymentStatus: PaymentStatus;
  paidAt: Date | null;
}

export interface ProviderWebhookEvent {
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly code: string;
  createCustomer(input: ProviderCustomerInput): Promise<ProviderCustomerResult>;
  updateCustomer(
    providerCustomerId: string,
    input: Partial<ProviderCustomerInput>,
  ): Promise<ProviderCustomerResult>;
  createProduct(input: ProviderProductInput): Promise<ProviderProductResult>;
  createPrice(input: ProviderPriceInput): Promise<ProviderPriceResult>;
  createSubscription(
    input: ProviderSubscriptionInput,
  ): Promise<ProviderSubscriptionResult>;
  cancelSubscription(
    providerSubscriptionId: string,
    cancelAtPeriodEnd?: boolean,
  ): Promise<ProviderSubscriptionResult>;
  resumeSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionResult>;
  changeSubscriptionPlan(
    input: ProviderChangeSubscriptionPlanInput,
  ): Promise<ProviderSubscriptionResult>;
  previewSubscriptionPlanChange(
    input: ProviderPlanChangePreviewInput,
  ): Promise<ProviderPlanChangePreviewResult>;
  cancelScheduledPlanChange(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionResult>;
  validateCustomerPaymentMethod(providerCustomerId: string): Promise<void>;
  setDefaultPaymentMethod(
    providerCustomerId: string,
    providerPaymentMethodId: string,
  ): Promise<void>;
  retrieveSubscription(
    providerSubscriptionId: string,
  ): Promise<ProviderSubscriptionResult>;
  createCheckoutSession(
    input: ProviderCheckoutSessionInput,
  ): Promise<ProviderCheckoutSessionResult>;
  retrieveCheckoutSession(sessionId: string): Promise<{
    status: string | null;
    providerSubscriptionId: string | null;
    providerCustomerId: string | null;
    metadata: Record<string, string>;
    customerEmail: string | null;
    customerName: string | null;
  }>;
  createBillingPortalSession(
    input: ProviderBillingPortalSessionInput,
  ): Promise<ProviderBillingPortalSessionResult>;
  retrievePaymentMethod(
    providerPaymentMethodId: string,
  ): Promise<ProviderPaymentMethodResult>;
  listPaymentMethods(
    providerCustomerId: string,
  ): Promise<ProviderPaymentMethodResult[]>;
  attachPaymentMethod(
    providerCustomerId: string,
    providerPaymentMethodId: string,
  ): Promise<ProviderPaymentMethodResult>;
  listInvoices(providerCustomerId: string): Promise<ProviderInvoiceResult[]>;
  constructWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): Promise<ProviderWebhookEvent>;
}
