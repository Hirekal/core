/**
 * @fileoverview Payment provider lookup service.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentProvider } from './entities/payment-provider.entity';
import { BaseRepository } from '../common/repositories/base.repository';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
} from '../common/messages/payment.messages';

@Injectable()
export class PaymentProvidersService {
  private readonly logger = new Logger(PaymentProvidersService.name);

  constructor(
    @InjectRepository(PaymentProvider)
    private readonly paymentProvidersRepository: Repository<PaymentProvider>,
  ) {}

  /*
   * Lists all configured payment providers ordered by creation date.
   */
  async findAll(): Promise<PaymentProvider[]> {
    try {
      return this.paymentProvidersRepository.find({
        order: { createdAt: 'ASC' },
      });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PAYMENT_PROVIDER.LIST_FAILED, error);
      throw error;
    }
  }

  /*
   * Finds a payment provider by its code (e.g. STRIPE).
   */
  async findByCode(code: string): Promise<PaymentProvider> {
    try {
      return BaseRepository.findOneOrFail(
        this.paymentProvidersRepository,
        { code: code.toUpperCase() },
        ERROR_MESSAGES.PAYMENT_PROVIDER.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PAYMENT_PROVIDER.FIND_FAILED(code), error);
      throw error;
    }
  }

  /*
   * Finds a payment provider by internal ID.
   */
  async findById(id: string): Promise<PaymentProvider> {
    try {
      return BaseRepository.findOneOrFail(
        this.paymentProvidersRepository,
        { id },
        ERROR_MESSAGES.PAYMENT_PROVIDER.NOT_FOUND,
      );
    } catch (error) {
      this.logger.error(LOG_MESSAGES.PAYMENT_PROVIDER.FIND_FAILED(id), error);
      throw error;
    }
  }
}
