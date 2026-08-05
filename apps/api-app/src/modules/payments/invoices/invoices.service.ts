/**
 * @fileoverview Invoice synchronization service.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { PaymentCustomersService } from '../payment-customers/payment-customers.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsRecordService } from '../payments-record/payments-record.service';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { BaseRepository } from '../common/repositories/base.repository';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
} from '../common/messages/payment.messages';
import {
  RecordStatus,
  PaymentStatus,
  InvoiceStatus,
  PaymentProviderCode,
} from '../common/enums/payment.enums';
import { ProviderInvoiceResult } from '../providers/payment-provider.interface';
import { toMajorAmount } from '../common/utils/currency-amount.util';
import { PricesService } from '../prices/prices.service';
import { formatPlanDisplayName } from '../common/utils/plan-display.util';
import { StripeProvider } from '../providers/stripe/stripe.provider';

export interface InvoiceResponse {
  id: string;
  organizationId: string;
  subscriptionId: string | null;
  paymentProviderId: string;
  providerInvoiceId: string;
  planName: string | null;
  invoiceNumber: string;
  receiptUrl: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  invoiceStatus: InvoiceStatus;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  paidAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoicesRepository: Repository<Invoice>,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly paymentCustomersService: PaymentCustomersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly paymentsRecordService: PaymentsRecordService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly pricesService: PricesService,
    private readonly stripeProvider: StripeProvider,
  ) {}

  /*
   * Returns a single record by internal ID or throws if not found.
   */
  async findOne(id: string): Promise<Invoice> {
    try {
      return BaseRepository.findOneOrFail(
        this.invoicesRepository,
        { id },
        ERROR_MESSAGES.INVOICE.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.INVOICE.SYNC_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Lists invoices stored locally for a payment customer.
   */
  async listByCustomer(
    customerId: string,
    paymentProviderId: string,
  ): Promise<InvoiceResponse[]> {
    try {
      const customer = await this.paymentCustomersService.findOne(customerId);
      const provider =
        await this.paymentProvidersService.findById(paymentProviderId);
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );
      const providerInvoices = await paymentProvider.listInvoices(
        customer.providerCustomerId,
      );

      await Promise.all(
        providerInvoices.map((providerInvoice) =>
          this.syncFromProviderResult(
            paymentProviderId,
            customer.organizationId,
            providerInvoice,
          ),
        ),
      );

      await this.backfillPaymentSubscriptions(customer.organizationId);

      return Promise.all(
        (
          await this.invoicesRepository.find({
            where: { organizationId: customer.organizationId },
            order: { createdAt: 'DESC' },
          })
        ).map((invoice) => this.formatInvoiceForApi(invoice, provider.code)),
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.INVOICE.LIST_FAILED(customerId), error);
      throw error;
    }
  }

  /*
   * Upserts local state from a provider API or webhook result.
   */
  async syncFromProviderResult(
    paymentProviderId: string,
    organizationId: string,
    providerResult: ProviderInvoiceResult,
  ): Promise<Invoice> {
    try {
      const provider =
        await this.paymentProvidersService.findById(paymentProviderId);

      const resolvedPlanName = await this.resolvePlanName(
        provider.code,
        providerResult,
      );

      let subscriptionId: string | null = null;
      if (providerResult.providerSubscriptionId) {
        subscriptionId = await this.resolveSubscriptionId(
          organizationId,
          paymentProviderId,
          provider.code,
          providerResult.providerSubscriptionId,
        );
      }

      const providerPaymentId = await this.resolveProviderPaymentId(
        provider.code,
        providerResult,
      );
      const syncedProviderResult: ProviderInvoiceResult = {
        ...providerResult,
        planName: resolvedPlanName ?? providerResult.planName ?? null,
        providerPaymentId,
      };

      let paymentId: string | null = null;
      if (providerPaymentId && providerResult.amountPaid > 0) {
        const customer =
          await this.paymentCustomersService.findByOrganizationAndPaymentProviderId(
            organizationId,
            paymentProviderId,
          );
        if (customer) {
          const payment = await this.paymentsRecordService
            .syncFromProviderResult(
              provider.code,
              {
                providerPaymentId,
                providerCustomerId: customer.providerCustomerId,
                providerSubscriptionId: providerResult.providerSubscriptionId,
                amount: providerResult.amountPaid,
                currency: providerResult.currency,
                paymentMethod: null,
                paymentStatus:
                  providerResult.invoiceStatus === InvoiceStatus.PAID
                    ? PaymentStatus.SUCCESS
                    : PaymentStatus.PENDING,
                paidAt: providerResult.paidAt,
              },
              organizationId,
              subscriptionId,
            )
            .catch((error) => {
              this.logger.warn(
                `Payment sync skipped for invoice ${providerResult.providerInvoiceId}`,
                error,
              );
              return null;
            });
          paymentId = payment?.id ?? null;
        }
      }

      if (subscriptionId) {
        await this.paymentsRecordService.linkSubscription({
          organizationId,
          paymentProviderId: provider.id,
          subscriptionId,
          providerPaymentId,
          amount: providerResult.amountPaid,
          currency: providerResult.currency,
        });
      }

      const existingInvoice = await this.invoicesRepository.findOne({
        where: {
          paymentProviderId: provider.id,
          providerInvoiceId: providerResult.providerInvoiceId,
        },
      });

      if (existingInvoice) {
        Object.assign(existingInvoice, {
          subscriptionId: subscriptionId ?? existingInvoice.subscriptionId,
          paymentId: paymentId ?? existingInvoice.paymentId,
          amountDue: providerResult.amountDue,
          amountPaid: providerResult.amountPaid,
          currency: providerResult.currency,
          invoiceStatus: providerResult.invoiceStatus,
          invoiceUrl: providerResult.invoiceUrl,
          invoicePdf: providerResult.invoicePdf,
          paidAt: providerResult.paidAt,
          status: RecordStatus.ACTIVE,
          metadata: this.buildInvoiceMetadata(
            existingInvoice.metadata,
            syncedProviderResult,
          ),
        });
        return this.invoicesRepository.save(existingInvoice);
      }

      return BaseRepository.createAndSave(this.invoicesRepository, {
        organizationId,
        subscriptionId,
        paymentId,
        paymentProviderId: provider.id,
        providerInvoiceId: providerResult.providerInvoiceId,
        amountDue: providerResult.amountDue,
        amountPaid: providerResult.amountPaid,
        currency: providerResult.currency,
        invoiceStatus: providerResult.invoiceStatus,
        invoiceUrl: providerResult.invoiceUrl,
        invoicePdf: providerResult.invoicePdf,
        paidAt: providerResult.paidAt,
        status: RecordStatus.ACTIVE,
        metadata: this.buildInvoiceMetadata(null, syncedProviderResult),
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.INVOICE.SYNC_FAILED(providerResult.providerInvoiceId),
        error,
      );
      throw error;
    }
  }

  /*
   * Converts stored minor-unit invoice amounts to major units for API clients.
   */
  private async formatInvoiceForApi(
    invoice: Invoice,
    providerCode: string,
  ): Promise<InvoiceResponse> {
    const metadata = invoice.metadata ?? {};
    const planName = await this.resolveStoredPlanName(
      metadata,
      providerCode,
      invoice.amountPaid > 0 ? invoice.amountPaid : invoice.amountDue,
      invoice.currency,
    );

    return {
      id: invoice.id,
      organizationId: invoice.organizationId,
      subscriptionId: invoice.subscriptionId,
      paymentProviderId: invoice.paymentProviderId,
      providerInvoiceId: invoice.providerInvoiceId,
      planName,
      invoiceNumber:
        (typeof metadata.invoiceNumber === 'string' &&
        metadata.invoiceNumber.length > 0
          ? metadata.invoiceNumber
          : null) ?? invoice.providerInvoiceId,
      receiptUrl: this.resolveReceiptUrlForApi(invoice, metadata),
      amountDue: toMajorAmount(invoice.amountDue, invoice.currency),
      amountPaid: toMajorAmount(invoice.amountPaid, invoice.currency),
      currency: invoice.currency,
      invoiceStatus: invoice.invoiceStatus,
      invoiceUrl: invoice.invoiceUrl,
      invoicePdf: invoice.invoicePdf,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
      metadata: invoice.metadata,
    };
  }

  /*
   * Persists invoice display metadata synced from the payment provider.
   */
  private buildInvoiceMetadata(
    existing: Record<string, unknown> | null | undefined,
    providerResult: ProviderInvoiceResult,
  ): Record<string, unknown> {
    const metadata = { ...(existing ?? {}) };

    if (providerResult.planName) {
      metadata.planName = providerResult.planName;
    }
    if (providerResult.providerPriceId) {
      metadata.providerPriceId = providerResult.providerPriceId;
    }
    if (providerResult.providerSubscriptionId) {
      metadata.providerSubscriptionId = providerResult.providerSubscriptionId;
    }
    if (providerResult.providerPaymentId) {
      metadata.providerPaymentId = providerResult.providerPaymentId;
    }
    if (providerResult.receiptUrl) {
      metadata.receiptUrl = providerResult.receiptUrl;
    }
    if (providerResult.invoiceNumber) {
      metadata.invoiceNumber = providerResult.invoiceNumber;
    }

    return metadata;
  }

  /*
   * Resolves a receipt URL from synced metadata or paid invoice links.
   */
  private resolveReceiptUrlForApi(
    invoice: Invoice,
    metadata: Record<string, unknown>,
  ): string | null {
    if (
      typeof metadata.receiptUrl === 'string' &&
      metadata.receiptUrl.length > 0
    ) {
      return metadata.receiptUrl;
    }

    if (invoice.invoiceStatus !== InvoiceStatus.PAID) {
      return null;
    }

    return invoice.invoiceUrl ?? invoice.invoicePdf ?? null;
  }

  /*
   * Resolves the plan label from synced metadata or the catalog price record.
   */
  private async resolvePlanName(
    providerCode: string,
    providerResult: ProviderInvoiceResult,
  ): Promise<string | null> {
    const fromPriceId = await this.resolvePlanNameFromPriceId(
      providerCode,
      providerResult.providerPriceId,
    );
    if (fromPriceId) {
      return fromPriceId;
    }

    const invoiceAmount =
      providerResult.amountPaid > 0
        ? providerResult.amountPaid
        : providerResult.amountDue;
    const fromAmount = await this.resolvePlanNameFromAmount(
      providerCode,
      invoiceAmount,
      providerResult.currency,
    );
    if (fromAmount) {
      return fromAmount;
    }

    return providerResult.planName ?? null;
  }

  /*
   * Reads a stored plan label, falling back to catalog lookup when needed.
   */
  private async resolveStoredPlanName(
    metadata: Record<string, unknown>,
    providerCode: string,
    amountMinor: number,
    currency: string,
  ): Promise<string | null> {
    const fromPriceId = await this.resolvePlanNameFromPriceId(
      providerCode,
      typeof metadata.providerPriceId === 'string'
        ? metadata.providerPriceId
        : null,
    );
    if (fromPriceId) {
      return fromPriceId;
    }

    const fromAmount = await this.resolvePlanNameFromAmount(
      providerCode,
      amountMinor,
      currency,
    );
    if (fromAmount) {
      return fromAmount;
    }

    if (typeof metadata.planName === 'string' && metadata.planName.length > 0) {
      return metadata.planName;
    }

    return null;
  }

  /*
   * Resolves a plan label from a provider price ID in the local catalog.
   */
  private async resolvePlanNameFromPriceId(
    providerCode: string,
    providerPriceId: string | null | undefined,
  ): Promise<string | null> {
    if (!providerPriceId) {
      return null;
    }

    const price = await this.pricesService.findByProviderPriceId(
      providerPriceId,
      providerCode,
    );
    if (!price?.product) {
      return null;
    }

    return formatPlanDisplayName(
      price.product.name,
      price.interval,
      price.intervalCount ?? 1,
    );
  }

  /*
   * Resolves a plan label by matching the invoice amount to a catalog price.
   */
  private async resolvePlanNameFromAmount(
    providerCode: string,
    amountMinor: number,
    currency: string,
  ): Promise<string | null> {
    if (amountMinor <= 0) {
      return null;
    }

    const price = await this.pricesService.findByProviderAmount(
      amountMinor,
      currency,
      providerCode,
    );
    if (!price?.product) {
      return null;
    }

    return formatPlanDisplayName(
      price.product.name,
      price.interval,
      price.intervalCount ?? 1,
    );
  }

  /*
   * Links an invoice to a local subscription, syncing from Stripe when missing.
   */
  private async resolveSubscriptionId(
    organizationId: string,
    paymentProviderId: string,
    providerCode: string,
    providerSubscriptionId: string,
  ): Promise<string | null> {
    const existingSubscription =
      await this.subscriptionsService.findByProviderSubscriptionId(
        providerSubscriptionId,
        providerCode,
      );
    if (existingSubscription) {
      return existingSubscription.id;
    }

    const customer =
      await this.paymentCustomersService.findByOrganizationAndPaymentProviderId(
        organizationId,
        paymentProviderId,
      );
    if (!customer) {
      return null;
    }

    const syncedSubscription =
      await this.subscriptionsService.syncFromStripeCheckout({
        organizationId,
        providerCode,
        providerCustomerId: customer.providerCustomerId,
        providerSubscriptionId,
      });

    return syncedSubscription?.id ?? null;
  }

  /*
   * Resolves a Stripe payment intent ID, fetching the invoice when list data is sparse.
   */
  private async resolveProviderPaymentId(
    providerCode: string,
    providerResult: ProviderInvoiceResult,
  ): Promise<string | null> {
    if (providerResult.providerPaymentId) {
      return providerResult.providerPaymentId;
    }

    if (providerCode !== PaymentProviderCode.STRIPE) {
      return null;
    }

    return this.stripeProvider.retrieveInvoicePaymentIntentId(
      providerResult.providerInvoiceId,
    );
  }

  /*
   * Backfills payment.subscriptionId from synced invoice rows for a user.
   */
  private async backfillPaymentSubscriptions(
    organizationId: string,
  ): Promise<void> {
    const invoices = await this.invoicesRepository.find({
      where: { organizationId },
      select: {
        id: true,
        subscriptionId: true,
        paymentId: true,
        amountPaid: true,
        currency: true,
        paymentProviderId: true,
        metadata: true,
      },
    });

    for (const invoice of invoices) {
      if (!invoice.subscriptionId) {
        continue;
      }

      if (invoice.paymentId) {
        await this.paymentsRecordService.setSubscriptionId(
          invoice.paymentId,
          invoice.subscriptionId,
        );
        continue;
      }

      const metadata = invoice.metadata ?? {};
      const providerPaymentId =
        typeof metadata.providerPaymentId === 'string'
          ? metadata.providerPaymentId
          : null;

      await this.paymentsRecordService.linkSubscription({
        organizationId,
        paymentProviderId: invoice.paymentProviderId,
        subscriptionId: invoice.subscriptionId,
        providerPaymentId,
        amount: invoice.amountPaid,
        currency: invoice.currency,
      });
    }
  }
}
