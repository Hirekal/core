/**
 * @fileoverview Payment customer persistence and provider synchronization service.
 */
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentCustomer } from './entities/payment-customer.entity';
import { CreatePaymentCustomerDto } from './dto/create-payment-customer.dto';
import { UpdatePaymentCustomerDto } from './dto/update-payment-customer.dto';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { BaseRepository } from '../common/repositories/base.repository';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
} from '../common/messages/payment.messages';
import { RecordStatus } from '../common/enums/payment.enums';

@Injectable()
export class PaymentCustomersService {
  private readonly logger = new Logger(PaymentCustomersService.name);

  constructor(
    @InjectRepository(PaymentCustomer)
    private readonly paymentCustomersRepository: Repository<PaymentCustomer>,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
  ) {}

  /*
   * Creates a provider customer and persists the local payment customer record.
   */
  async create(
    userId: string,
    dto: CreatePaymentCustomerDto,
  ): Promise<PaymentCustomer> {
    try {
      const provider = await this.paymentProvidersService.findById(
        dto.paymentProviderId,
      );

      const existingPaymentCustomer =
        await this.paymentCustomersRepository.findOne({
          where: { userId, paymentProviderId: provider.id },
        });
      if (existingPaymentCustomer) {
        throw new ConflictException(
          ERROR_MESSAGES.PAYMENT_CUSTOMER.ALREADY_EXISTS,
        );
      }

      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );
      const providerCustomer = await paymentProvider.createCustomer({
        email: dto.email,
        name: dto.name,
        metadata: dto.metadata,
      });

      return BaseRepository.createAndSave(this.paymentCustomersRepository, {
        userId,
        paymentProviderId: provider.id,
        providerCustomerId: providerCustomer.providerCustomerId,
        email: dto.email,
        name: dto.name ?? null,
        status: RecordStatus.ACTIVE,
        metadata: dto.metadata ?? {},
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.CREATE_FAILED(userId),
        error,
      );
      throw error;
    }
  }

  /*
   * Updates an existing record locally and on the payment provider when applicable.
   */
  async update(
    id: string,
    dto: UpdatePaymentCustomerDto,
  ): Promise<PaymentCustomer> {
    try {
      const customer = await this.findOne(id);
      const provider = await this.paymentProvidersService.findById(
        customer.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );

      await paymentProvider.updateCustomer(customer.providerCustomerId, {
        email: dto.email,
        name: dto.name,
        metadata: dto.metadata,
      });

      Object.assign(customer, {
        email: dto.email ?? customer.email,
        name: dto.name ?? customer.name,
        metadata: dto.metadata ?? customer.metadata,
      });

      return this.paymentCustomersRepository.save(customer);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PAYMENT_CUSTOMER.UPDATE_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Returns a single record by internal ID or throws if not found.
   */
  async findOne(id: string): Promise<PaymentCustomer> {
    try {
      return BaseRepository.findOneOrFail(
        this.paymentCustomersRepository,
        { id },
        ERROR_MESSAGES.PAYMENT_CUSTOMER.NOT_FOUND,
        { paymentProvider: true },
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PAYMENT_CUSTOMER.FIND_FAILED(id), error);
      throw error;
    }
  }

  /*
   * Finds a payment customer for a user and provider combination.
   */
  async findByUserAndPaymentProviderId(
    userId: string,
    paymentProviderId: string,
  ): Promise<PaymentCustomer | null> {
    try {
      return this.paymentCustomersRepository.findOne({
        where: { userId, paymentProviderId },
        relations: { paymentProvider: true },
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.FIND_FAILED(
          `${userId}:${paymentProviderId}`,
        ),
        error,
      );
      throw error;
    }
  }

  /*
   * Find By User And Provider Code.
   */
  async findByUserAndProviderCode(
    userId: string,
    providerCode: string,
  ): Promise<PaymentCustomer | null> {
    try {
      const provider =
        await this.paymentProvidersService.findByCode(providerCode);
      return this.paymentCustomersRepository.findOne({
        where: { userId, paymentProviderId: provider.id },
        relations: { paymentProvider: true },
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.FIND_FAILED(`${userId}:${providerCode}`),
        error,
      );
      throw error;
    }
  }

  /*
   * Finds a payment customer by the provider-side customer ID.
   */
  async findByProviderCustomerId(
    providerCustomerId: string,
    providerCode: string,
  ): Promise<PaymentCustomer | null> {
    try {
      const provider =
        await this.paymentProvidersService.findByCode(providerCode);
      return this.paymentCustomersRepository.findOne({
        where: { providerCustomerId, paymentProviderId: provider.id },
        relations: { paymentProvider: true },
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.FIND_FAILED(providerCustomerId),
        error,
      );
      throw error;
    }
  }

  /*
   * Creates or updates a local record from provider webhook data.
   */
  async upsertFromProvider(input: {
    userId: string;
    providerCode: string;
    providerCustomerId: string;
    email: string;
    name?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentCustomer> {
    try {
      const provider = await this.paymentProvidersService.findByCode(
        input.providerCode,
      );
      const existingPaymentCustomer =
        await this.paymentCustomersRepository.findOne({
          where: {
            paymentProviderId: provider.id,
            providerCustomerId: input.providerCustomerId,
          },
        });

      if (existingPaymentCustomer) {
        Object.assign(existingPaymentCustomer, {
          email: input.email,
          name: input.name ?? existingPaymentCustomer.name,
          metadata: input.metadata ?? existingPaymentCustomer.metadata,
        });
        return this.paymentCustomersRepository.save(existingPaymentCustomer);
      }

      return BaseRepository.createAndSave(this.paymentCustomersRepository, {
        userId: input.userId,
        paymentProviderId: provider.id,
        providerCustomerId: input.providerCustomerId,
        email: input.email,
        name: input.name ?? null,
        status: RecordStatus.ACTIVE,
        metadata: input.metadata ?? {},
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.UPDATE_FAILED(input.providerCustomerId),
        error,
      );
      throw error;
    }
  }
}
