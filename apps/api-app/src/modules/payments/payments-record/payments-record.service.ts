/**
 * @fileoverview Payment record synchronization service.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { PaymentCustomersService } from '../payment-customers/payment-customers.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BaseRepository } from '../common/repositories/base.repository';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
} from '../common/messages/payment.messages';
import { RecordStatus, PaymentStatus } from '../common/enums/payment.enums';
import { ProviderPaymentResult } from '../providers/payment-provider.interface';

@Injectable()
export class PaymentsRecordService {
  private readonly logger = new Logger(PaymentsRecordService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly paymentCustomersService: PaymentCustomersService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /*
   * Returns a single record by internal ID or throws if not found.
   */
  async findOne(id: string): Promise<Payment> {
    try {
      return BaseRepository.findOneOrFail(
        this.paymentsRepository,
        { id },
        ERROR_MESSAGES.PAYMENT.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PAYMENT.SYNC_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Upserts local state from a provider API or webhook result.
   */
  async syncFromProviderResult(
    providerCode: string,
    providerResult: ProviderPaymentResult,
    organizationId?: string,
    knownSubscriptionId?: string | null,
  ): Promise<Payment> {
    try {
      const provider =
        await this.paymentProvidersService.findByCode(providerCode);
      const customer =
        await this.paymentCustomersService.findByProviderCustomerId(
          providerResult.providerCustomerId,
          providerCode,
        );

      if (!customer) {
        throw new Error(ERROR_MESSAGES.PAYMENT_CUSTOMER.NOT_FOUND);
      }

      const resolvedOrganizationId = organizationId ?? customer.organizationId;
      let subscriptionId = knownSubscriptionId ?? null;
      if (!subscriptionId && providerResult.providerSubscriptionId) {
        subscriptionId = await this.resolveSubscriptionId(
          resolvedOrganizationId,
          provider.id,
          providerCode,
          providerResult.providerSubscriptionId,
        );
      }

      const existingPayment = await this.paymentsRepository.findOne({
        where: {
          paymentProviderId: provider.id,
          providerPaymentId: providerResult.providerPaymentId,
        },
      });

      const resolvedSubscriptionId =
        knownSubscriptionId ?? subscriptionId ?? existingPayment?.subscriptionId ?? null;

      if (providerResult.providerSubscriptionId && !resolvedSubscriptionId) {
        throw new Error(ERROR_MESSAGES.PAYMENT.SUBSCRIPTION_NOT_LINKED);
      }

      if (existingPayment) {
        Object.assign(existingPayment, {
          amount: providerResult.amount,
          currency: providerResult.currency,
          paymentMethod: providerResult.paymentMethod,
          paymentStatus: providerResult.paymentStatus,
          paidAt: providerResult.paidAt,
          subscriptionId: resolvedSubscriptionId,
          status: RecordStatus.ACTIVE,
        });
        return this.paymentsRepository.save(existingPayment);
      }

      return BaseRepository.createAndSave(this.paymentsRepository, {
        organizationId: resolvedOrganizationId,
        customerId: customer.id,
        subscriptionId: resolvedSubscriptionId,
        paymentProviderId: provider.id,
        providerPaymentId: providerResult.providerPaymentId,
        amount: providerResult.amount,
        currency: providerResult.currency,
        paymentMethod: providerResult.paymentMethod,
        paymentStatus: providerResult.paymentStatus,
        paidAt: providerResult.paidAt,
        status: RecordStatus.ACTIVE,
        metadata: {},
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT.SYNC_FAILED(providerResult.providerPaymentId),
        error,
      );
      throw error;
    }
  }

  /*
   * Upserts a payment row after checkout with a known subscription link.
   */
  async upsertAfterCheckout(input: {
    organizationId: string;
    customerId: string;
    subscriptionId: string;
    paymentProviderId: string;
    providerPaymentId: string;
    providerCustomerId: string;
    providerSubscriptionId: string;
    amount: number;
    currency: string;
    paidAt?: Date | null;
    paymentStatus: PaymentStatus;
  }): Promise<Payment> {
    const existingPayment = await this.paymentsRepository.findOne({
      where: {
        paymentProviderId: input.paymentProviderId,
        providerPaymentId: input.providerPaymentId,
      },
    });

    if (existingPayment) {
      Object.assign(existingPayment, {
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        paymentStatus: input.paymentStatus,
        paidAt: input.paidAt ?? existingPayment.paidAt,
        subscriptionId: input.subscriptionId,
        status: RecordStatus.ACTIVE,
      });
      return this.paymentsRepository.save(existingPayment);
    }

    return BaseRepository.createAndSave(this.paymentsRepository, {
      organizationId: input.organizationId,
      customerId: input.customerId,
      subscriptionId: input.subscriptionId,
      paymentProviderId: input.paymentProviderId,
      providerPaymentId: input.providerPaymentId,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      paymentMethod: null,
      paymentStatus: input.paymentStatus,
      paidAt: input.paidAt ?? null,
      status: RecordStatus.ACTIVE,
      metadata: {},
    });
  }

  /*
   * Links a payment to a local subscription, syncing from Stripe when missing.
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
   * Links existing payment rows to a subscription after invoice sync.
   */
  async linkSubscription(input: {
    organizationId: string;
    paymentProviderId: string;
    subscriptionId: string;
    providerPaymentId?: string | null;
    amount?: number;
    currency?: string;
  }): Promise<void> {
    if (input.providerPaymentId) {
      const payment = await this.paymentsRepository.findOne({
        where: {
          paymentProviderId: input.paymentProviderId,
          providerPaymentId: input.providerPaymentId,
        },
      });
      if (payment) {
        if (!payment.subscriptionId) {
          payment.subscriptionId = input.subscriptionId;
          await this.paymentsRepository.save(payment);
        }
        return;
      }
    }

    if (!input.amount || input.amount <= 0 || !input.currency) {
      return;
    }

    const candidates = await this.paymentsRepository.find({
      where: {
        organizationId: input.organizationId,
        paymentProviderId: input.paymentProviderId,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        subscriptionId: IsNull(),
      },
      order: { createdAt: 'DESC' },
      take: 3,
    });

    for (const payment of candidates) {
      payment.subscriptionId = input.subscriptionId;
      await this.paymentsRepository.save(payment);
    }
  }

  /*
   * Sets subscriptionId on a payment when still unlinked.
   */
  async setSubscriptionId(
    paymentId: string,
    subscriptionId: string,
  ): Promise<void> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (payment && !payment.subscriptionId) {
      payment.subscriptionId = subscriptionId;
      await this.paymentsRepository.save(payment);
    }
  }
}
