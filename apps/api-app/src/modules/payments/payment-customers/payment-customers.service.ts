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
import { User } from '../../auth/users/entities/user.entity';

@Injectable()
export class PaymentCustomersService {
  private readonly logger = new Logger(PaymentCustomersService.name);

  constructor(
    @InjectRepository(PaymentCustomer)
    private readonly paymentCustomersRepository: Repository<PaymentCustomer>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly paymentProvidersService: PaymentProvidersService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
  ) {}

  /*
   * Creates a provider customer and persists the local payment customer record.
   */
  async create(
    organizationId: string,
    dto: CreatePaymentCustomerDto,
  ): Promise<PaymentCustomer> {
    try {
      const provider = await this.paymentProvidersService.findById(
        dto.paymentProviderId,
      );

      const existingPaymentCustomer =
        await this.paymentCustomersRepository.findOne({
          where: { organizationId, paymentProviderId: provider.id },
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
        metadata: {
          ...(dto.metadata ?? {}),
          organizationId,
        },
      });

      return BaseRepository.createAndSave(this.paymentCustomersRepository, {
        organizationId,
        paymentProviderId: provider.id,
        providerCustomerId: providerCustomer.providerCustomerId,
        email: dto.email,
        name: dto.name ?? null,
        status: RecordStatus.ACTIVE,
        metadata: dto.metadata ?? {},
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.CREATE_FAILED(organizationId),
        error,
      );
      throw error;
    }
  }

  /*
   * Ensures the organization has an active provider customer before checkout.
   */
  async ensureActiveForCheckout(
    organizationId: string,
    dto: CreatePaymentCustomerDto,
  ): Promise<PaymentCustomer> {
    try {
      const provider = await this.paymentProvidersService.findById(
        dto.paymentProviderId,
      );
      const paymentProvider = this.paymentProviderRegistry.resolve(
        provider.code,
      );

      const existingCustomer = await this.paymentCustomersRepository.findOne({
        where: { organizationId, paymentProviderId: provider.id },
      });

      if (
        existingCustomer &&
        (await paymentProvider.isProviderCustomerActive(
          existingCustomer.providerCustomerId,
        ))
      ) {
        if (dto.email && dto.email !== existingCustomer.email) {
          existingCustomer.email = dto.email;
        }
        if (dto.name && dto.name !== existingCustomer.name) {
          existingCustomer.name = dto.name;
        }
        return this.paymentCustomersRepository.save(existingCustomer);
      }

      const providerCustomer = await paymentProvider.createCustomer({
        email: dto.email,
        name: dto.name,
        metadata: {
          ...(dto.metadata ?? {}),
          organizationId,
        },
      });

      if (existingCustomer) {
        existingCustomer.providerCustomerId =
          providerCustomer.providerCustomerId;
        existingCustomer.email = dto.email;
        existingCustomer.name = dto.name ?? null;
        existingCustomer.metadata = dto.metadata ?? existingCustomer.metadata;
        existingCustomer.status = RecordStatus.ACTIVE;
        return this.paymentCustomersRepository.save(existingCustomer);
      }

      return BaseRepository.createAndSave(this.paymentCustomersRepository, {
        organizationId,
        paymentProviderId: provider.id,
        providerCustomerId: providerCustomer.providerCustomerId,
        email: dto.email,
        name: dto.name ?? null,
        status: RecordStatus.ACTIVE,
        metadata: dto.metadata ?? {},
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.CREATE_FAILED(organizationId),
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
   * Finds a payment customer for an organization and provider combination.
   */
  async findByOrganizationAndPaymentProviderId(
    organizationId: string,
    paymentProviderId: string,
  ): Promise<PaymentCustomer | null> {
    try {
      return this.paymentCustomersRepository.findOne({
        where: { organizationId, paymentProviderId },
        relations: { paymentProvider: true },
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.FIND_FAILED(
          `${organizationId}:${paymentProviderId}`,
        ),
        error,
      );
      throw error;
    }
  }

  /*
   * Find By Organization And Provider Code.
   */
  async findByOrganizationAndProviderCode(
    organizationId: string,
    providerCode: string,
  ): Promise<PaymentCustomer | null> {
    try {
      const provider =
        await this.paymentProvidersService.findByCode(providerCode);
      return this.paymentCustomersRepository.findOne({
        where: { organizationId, paymentProviderId: provider.id },
        relations: { paymentProvider: true },
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.PAYMENT_CUSTOMER.FIND_FAILED(
          `${organizationId}:${providerCode}`,
        ),
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
   * Resolves organization ownership from provider metadata.
   */
  async resolveOrganizationIdFromMetadata(
    metadata?: Record<string, unknown> | null,
  ): Promise<string | null> {
    if (
      typeof metadata?.organizationId === 'string' &&
      metadata.organizationId.length > 0
    ) {
      return metadata.organizationId;
    }

    if (typeof metadata?.userId === 'string' && metadata.userId.length > 0) {
      const user = await this.usersRepository.findOne({
        where: { id: metadata.userId },
        select: { id: true, organizationId: true },
      });
      return user?.organizationId ?? null;
    }

    return null;
  }

  /*
   * Creates or updates a local record from provider webhook data.
   */
  async upsertFromProvider(input: {
    organizationId: string;
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
          organizationId: input.organizationId,
          email: input.email,
          name: input.name ?? existingPaymentCustomer.name,
          metadata: input.metadata ?? existingPaymentCustomer.metadata,
        });
        return this.paymentCustomersRepository.save(existingPaymentCustomer);
      }

      const existingByOrganization =
        await this.paymentCustomersRepository.findOne({
          where: {
            organizationId: input.organizationId,
            paymentProviderId: provider.id,
          },
        });

      if (existingByOrganization) {
        Object.assign(existingByOrganization, {
          providerCustomerId: input.providerCustomerId,
          email: input.email,
          name: input.name ?? existingByOrganization.name,
          metadata: input.metadata ?? existingByOrganization.metadata,
        });
        return this.paymentCustomersRepository.save(existingByOrganization);
      }

      return BaseRepository.createAndSave(this.paymentCustomersRepository, {
        organizationId: input.organizationId,
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
