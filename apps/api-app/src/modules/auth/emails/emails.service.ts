/**
 * @fileoverview Email log persistence service.
 * Records outbound email attempts and delivery status for audit and debugging.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog } from './entities/email-log.entity';
import { EmailLogStatus } from '../common/constants/auth.constants';
import { CreateEmailLogDto } from './dto/create-email-log.dto';
import { BaseRepository } from '../common/repositories/base.repository';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../common/constants/messages';
import { EMAIL_LOG_METADATA_KEYS } from '../common/constants/app.constants';
import { toDate } from '../common/utils/date.util';

/**
 * Manages email log records for tracking sent and pending outbound messages.
 */
@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);

  /**
   * Creates the emails service with an injected TypeORM repository.
   *
   * @param emailLogsRepository - TypeORM repository for email log entities
   */
  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogsRepository: Repository<EmailLog>,
  ) {}

  /**
   * Persists a new email log entry with optional user code metadata.
   *
   * @param emailLogDto - Email log creation payload
   * @returns Created email log entity
   */
  async log(emailLogDto: CreateEmailLogDto): Promise<EmailLog> {
    try {
      const status = emailLogDto.status ?? EmailLogStatus.PENDING;
      const metadata: Record<string, unknown> = {
        ...(emailLogDto.metadata ?? {}),
      };
      if (emailLogDto.userCodeId) {
        metadata[EMAIL_LOG_METADATA_KEYS.USER_CODE_ID] = emailLogDto.userCodeId;
      }

      return BaseRepository.createAndSave(this.emailLogsRepository, {
        userId: emailLogDto.userId ?? null,
        organizationId: emailLogDto.organizationId ?? null,
        email: emailLogDto.email,
        subject: emailLogDto.subject,
        status,
        providerMessageId: emailLogDto.providerMessageId ?? null,
        sentAt: status === EmailLogStatus.SENT ? toDate() : null,
        metadata,
      });
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.EMAIL.LOG_FAILED(emailLogDto.email),
        error,
      );
      throw error;
    }
  }

  /**
   * Marks an email log as sent and optionally records the provider message ID.
   *
   * @param id - Email log identifier
   * @param providerMessageId - Optional external provider message identifier
   * @returns Updated email log entity
   */
  async markSent(id: string, providerMessageId?: string): Promise<EmailLog> {
    try {
      const emailLog = await BaseRepository.findOneOrFail(
        this.emailLogsRepository,
        { id },
        ERROR_MESSAGES.EMAIL_LOG.NOT_FOUND,
      );
      emailLog.status = EmailLogStatus.SENT;
      emailLog.sentAt = toDate();
      if (providerMessageId) {
        emailLog.providerMessageId = providerMessageId;
      }
      return this.emailLogsRepository.save(emailLog);
    } catch (error) {
      this.logger.error(LOG_MESSAGES.EMAIL.MARK_SENT_FAILED(id), error);
      throw error;
    }
  }
}
