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
      return await this.ensureActiveForCheckout(organizationId, dto);
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
   * Safe under concurrent checkouts and soft-deleted unique rows.
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

      const existingCustomer = await this.findOrganizationProviderCustomer(
        organizationId,
        provider.id,
      );

      if (existingCustomer) {
        const isActive = await paymentProvider.isProviderCustomerActive(
          existingCustomer.providerCustomerId,
        );

        if (isActive) {
          return this.refreshLocalCustomer(existingCustomer, dto);
        }

        const providerCustomer = await paymentProvider.createCustomer({
          email: dto.email,
          name: dto.name,
          metadata: {
            ...(dto.metadata ?? {}),
            organizationId,
          },
        });

        existingCustomer.providerCustomerId =
          providerCustomer.providerCustomerId;
        return this.refreshLocalCustomer(existingCustomer, dto, {
          forceActive: true,
        });
      }

      const providerCustomer = await paymentProvider.createCustomer({
        email: dto.email,
        name: dto.name,
        metadata: {
          ...(dto.metadata ?? {}),
          organizationId,
        },
      });

      return this.upsertOrganizationProviderCustomer({
        organizationId,
        paymentProviderId: provider.id,
        providerCustomerId: providerCustomer.providerCustomerId,
        email: dto.email,
        name: dto.name ?? null,
        metadata: dto.metadata ?? {},
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
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
        address: dto.address,
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
          withDeleted: true,
        });

      if (existingPaymentCustomer) {
        existingPaymentCustomer.deletedAt = null;
        Object.assign(existingPaymentCustomer, {
          organizationId: input.organizationId,
          email: input.email,
          name: input.name ?? existingPaymentCustomer.name,
          metadata: input.metadata ?? existingPaymentCustomer.metadata,
          status: RecordStatus.ACTIVE,
        });
        return this.paymentCustomersRepository.save(existingPaymentCustomer);
      }

      const existingByOrganization = await this.findOrganizationProviderCustomer(
        input.organizationId,
        provider.id,
      );

      if (existingByOrganization) {
        Object.assign(existingByOrganization, {
          providerCustomerId: input.providerCustomerId,
          email: input.email,
          name: input.name ?? existingByOrganization.name,
          metadata: input.metadata ?? existingByOrganization.metadata,
          status: RecordStatus.ACTIVE,
        });
        return this.paymentCustomersRepository.save(existingByOrganization);
      }

      return this.upsertOrganizationProviderCustomer({
        organizationId: input.organizationId,
        paymentProviderId: provider.id,
        providerCustomerId: input.providerCustomerId,
        email: input.email,
        name: input.name ?? null,
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

  /*
   * Finds org+provider customer including soft-deleted rows that still hold
   * the unique constraint.
   */
  private async findOrganizationProviderCustomer(
    organizationId: string,
    paymentProviderId: string,
  ): Promise<PaymentCustomer | null> {
    return this.paymentCustomersRepository
      .createQueryBuilder('customer')
      .withDeleted()
      .where('customer.organizationId = :organizationId', { organizationId })
      .andWhere('customer.paymentProviderId = :paymentProviderId', {
        paymentProviderId,
      })
      .getOne();
  }

  /*
   * Inserts or updates the org/provider customer row atomically.
   */
  private async upsertOrganizationProviderCustomer(input: {
    organizationId: string;
    paymentProviderId: string;
    providerCustomerId: string;
    email: string;
    name: string | null;
    metadata: Record<string, unknown>;
  }): Promise<PaymentCustomer> {
    const rows = await this.paymentCustomersRepository.query(
      `
        INSERT INTO "paymentCustomers" (
          "organizationId",
          "paymentProviderId",
          "providerCustomerId",
          "email",
          "name",
          "status",
          "metadata",
          "deletedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NULL)
        ON CONFLICT ("organizationId", "paymentProviderId")
        DO UPDATE SET
          "providerCustomerId" = EXCLUDED."providerCustomerId",
          "email" = EXCLUDED."email",
          "name" = EXCLUDED."name",
          "status" = EXCLUDED."status",
          "metadata" = EXCLUDED."metadata",
          "deletedAt" = NULL,
          "updatedAt" = NOW()
        RETURNING *
      `,
      [
        input.organizationId,
        input.paymentProviderId,
        input.providerCustomerId,
        input.email,
        input.name,
        RecordStatus.ACTIVE,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.id) {
      const existing = await this.findOrganizationProviderCustomer(
        input.organizationId,
        input.paymentProviderId,
      );
      if (existing) {
        return existing;
      }
      throw new Error(ERROR_MESSAGES.PAYMENT_CUSTOMER.NOT_FOUND);
    }

    const customer = await this.findOrganizationProviderCustomer(
      input.organizationId,
      input.paymentProviderId,
    );
    if (!customer) {
      throw new Error(ERROR_MESSAGES.PAYMENT_CUSTOMER.NOT_FOUND);
    }
    return customer;
  }

  /*
   * Restores soft-deleted rows and refreshes local contact fields.
   */
  private async refreshLocalCustomer(
    customer: PaymentCustomer,
    dto: CreatePaymentCustomerDto,
    options?: { forceActive?: boolean },
  ): Promise<PaymentCustomer> {
    customer.deletedAt = null;
    if (options?.forceActive) {
      customer.status = RecordStatus.ACTIVE;
    }
    if (dto.email) {
      customer.email = dto.email;
    }
    if (dto.name !== undefined) {
      customer.name = dto.name ?? null;
    }
    if (dto.metadata) {
      customer.metadata = {
        ...(customer.metadata ?? {}),
        ...dto.metadata,
      };
    }
    return this.paymentCustomersRepository.save(customer);
  }
}
