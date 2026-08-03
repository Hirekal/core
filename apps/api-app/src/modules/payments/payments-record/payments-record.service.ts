/**
 * @fileoverview Payment record synchronization service.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { PaymentCustomersService } from '../payment-customers/payment-customers.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BaseRepository } from '../common/repositories/base.repository';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
} from '../common/messages/payment.messages';
import { RecordStatus } from '../common/enums/payment.enums';
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
    userId?: string,
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

      let subscriptionId: string | null = null;
      if (providerResult.providerSubscriptionId) {
        const subscription =
          await this.subscriptionsService.findByProviderSubscriptionId(
            providerResult.providerSubscriptionId,
            providerCode,
          );
        subscriptionId = subscription?.id ?? null;
      }

      const existingPayment = await this.paymentsRepository.findOne({
        where: {
          paymentProviderId: provider.id,
          providerPaymentId: providerResult.providerPaymentId,
        },
      });

      if (existingPayment) {
        Object.assign(existingPayment, {
          amount: providerResult.amount,
          currency: providerResult.currency,
          paymentMethod: providerResult.paymentMethod,
          paymentStatus: providerResult.paymentStatus,
          paidAt: providerResult.paidAt,
          subscriptionId,
          status: RecordStatus.ACTIVE,
        });
        return this.paymentsRepository.save(existingPayment);
      }

      return BaseRepository.createAndSave(this.paymentsRepository, {
        userId: userId ?? customer.userId,
        customerId: customer.id,
        subscriptionId,
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
}
