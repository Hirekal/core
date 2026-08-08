/**
 * @fileoverview Payment method synchronization service.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { PaymentCustomersService } from '../payment-customers/payment-customers.service';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { BaseRepository } from '../common/repositories/base.repository';
import { LOG_MESSAGES } from '../common/messages/payment.messages';
import { RecordStatus } from '../common/enums/payment.enums';
import { ProviderPaymentMethodResult } from '../providers/payment-provider.interface';

@Injectable()
export class PaymentMethodsService {
  private readonly logger = new Logger(PaymentMethodsService.name);

  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodsRepository: Repository<PaymentMethod>,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly paymentCustomersService: PaymentCustomersService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
  ) {}

  /*
   * Upserts local state from a provider API or webhook result.
   */
  async syncFromProviderResult(
    paymentProviderId: string,
    customerId: string,
    organizationId: string,
    providerResult: ProviderPaymentMethodResult,
  ): Promise<PaymentMethod> {
    try {
      const provider =
        await this.paymentProvidersService.findById(paymentProviderId);
      const existingPaymentMethod = await this.paymentMethodsRepository.findOne(
        {
          where: {
            paymentProviderId: provider.id,
            providerPaymentMethodId: providerResult.providerPaymentMethodId,
          },
        },
      );

      if (existingPaymentMethod) {
        Object.assign(existingPaymentMethod, {
          type: providerResult.type,
          brand: providerResult.brand,
          last4: providerResult.last4,
          expMonth: providerResult.expMonth,
          expYear: providerResult.expYear,
          isDefault: providerResult.isDefault,
          status: RecordStatus.ACTIVE,
        });
        return this.paymentMethodsRepository.save(existingPaymentMethod);
      }

      return BaseRepository.createAndSave(this.paymentMethodsRepository, {
        organizationId,
        customerId,
        paymentProviderId: provider.id,
        providerPaymentMethodId: providerResult.providerPaymentMethodId,
        type: providerResult.type,
        brand: providerResult.brand,
        last4: providerResult.last4,
        expMonth: providerResult.expMonth,
        expYear: providerResult.expYear,
        isDefault: providerResult.isDefault,
        status: RecordStatus.ACTIVE,
        metadata: {},
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_METHOD.SYNC_FAILED(
          providerResult.providerPaymentMethodId,
        ),
        error,
      );
      throw error;
    }
  }

  /*
   * Lists payment methods stored locally for a payment customer.
   */
  async listByCustomer(
    customerId: string,
    paymentProviderId?: string,
  ): Promise<PaymentMethod[]> {
    try {
      return this.paymentMethodsRepository.find({
        where: {
          customerId,
          status: RecordStatus.ACTIVE,
          ...(paymentProviderId ? { paymentProviderId } : {}),
        },
        order: { isDefault: 'DESC', createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_METHOD.SYNC_FAILED(customerId),
        error,
      );
      throw error;
    }
  }

  /*
   * Store Payment Method.
   */
  async storePaymentMethod(input: {
    paymentProviderId: string;
    customerId: string;
    organizationId: string;
    providerPaymentMethodId: string;
  }): Promise<PaymentMethod> {
    try {
      const customer = await this.paymentCustomersService.findOne(
        input.customerId,
      );
      const provider = await this.paymentProvidersService.findById(
        input.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );
      const providerMethod = await paymentProvider.attachPaymentMethod(
        customer.providerCustomerId,
        input.providerPaymentMethodId,
      );

      return this.syncFromProviderResult(
        input.paymentProviderId,
        customer.id,
        input.organizationId,
        providerMethod,
      );
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_METHOD.SYNC_FAILED(input.providerPaymentMethodId),
        error,
      );
      throw error;
    }
  }
}
