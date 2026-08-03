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
} from '../common/enums/payment.enums';
import { ProviderInvoiceResult } from '../providers/payment-provider.interface';
import { toMajorAmount } from '../common/utils/currency-amount.util';

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
  ): Promise<Invoice[]> {
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

      for (const providerInvoice of providerInvoices) {
        await this.syncFromProviderResult(
          paymentProviderId,
          customer.userId,
          providerInvoice,
        );
      }

      return (await this.invoicesRepository.find({
        where: { userId: customer.userId },
        order: { createdAt: 'DESC' },
      })).map((invoice) => this.formatInvoiceForApi(invoice));
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
    userId: string,
    providerResult: ProviderInvoiceResult,
  ): Promise<Invoice> {
    try {
      const provider =
        await this.paymentProvidersService.findById(paymentProviderId);

      let subscriptionId: string | null = null;
      if (providerResult.providerSubscriptionId) {
        const subscription =
          await this.subscriptionsService.findByProviderSubscriptionId(
            providerResult.providerSubscriptionId,
            provider.code,
          );
        subscriptionId = subscription?.id ?? null;
      }

      let paymentId: string | null = null;
      if (providerResult.providerPaymentId && providerResult.amountPaid > 0) {
        const customer =
          await this.paymentCustomersService.findByUserAndPaymentProviderId(
            userId,
            paymentProviderId,
          );
        if (customer) {
          const payment = await this.paymentsRecordService
            .syncFromProviderResult(
              provider.code,
              {
                providerPaymentId: providerResult.providerPaymentId,
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
              userId,
            )
            .catch(() => null);
          paymentId = payment?.id ?? null;
        }
      }

      const existingInvoice = await this.invoicesRepository.findOne({
        where: {
          paymentProviderId: provider.id,
          providerInvoiceId: providerResult.providerInvoiceId,
        },
      });

      if (existingInvoice) {
        Object.assign(existingInvoice, {
          subscriptionId,
          paymentId,
          amountDue: providerResult.amountDue,
          amountPaid: providerResult.amountPaid,
          currency: providerResult.currency,
          invoiceStatus: providerResult.invoiceStatus,
          invoiceUrl: providerResult.invoiceUrl,
          invoicePdf: providerResult.invoicePdf,
          paidAt: providerResult.paidAt,
          status: RecordStatus.ACTIVE,
        });
        return this.invoicesRepository.save(existingInvoice);
      }

      return BaseRepository.createAndSave(this.invoicesRepository, {
        userId,
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
        metadata: {},
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
  private formatInvoiceForApi(invoice: Invoice): Invoice {
    return {
      ...invoice,
      amountDue: toMajorAmount(invoice.amountDue, invoice.currency),
      amountPaid: toMajorAmount(invoice.amountPaid, invoice.currency),
    };
  }
}
