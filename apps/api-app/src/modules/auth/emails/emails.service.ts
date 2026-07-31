/**
 * @fileoverview Outbound email delivery and audit logging.
 * Sends transactional mail via Brevo and persists delivery records.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog } from './entities/email-log.entity';
import { EmailLogStatus } from '../common/constants/auth.constants';
import { CreateEmailLogDto } from './dto/create-email-log.dto';
import { BaseRepository } from '../common/repositories/base.repository';
import {
    EMAIL_SUBJECTS,
    ERROR_MESSAGES,
    LOG_MESSAGES,
} from '../common/constants/messages';
import { EMAIL_LOG_METADATA_KEYS } from '../common/constants/app.constants';
import { toDate } from '../common/utils/date.util';
import { BrevoEmailProvider } from './providers/brevo.provider';
import {
    buildPasswordResetEmailContent,
    buildVerificationEmailContent,
} from './templates/auth-email.templates';

export interface SendAuthCodeEmailParams {
    userId: string;
    organizationId: string | null;
    email: string;
    name: string;
    code: string;
    userCodeId: string;
}

/**
 * Manages transactional email sending and email log persistence.
 */
@Injectable()
export class EmailsService {
    private readonly logger = new Logger(EmailsService.name);

    /**
     * Creates the emails service with persistence and Brevo dependencies.
     *
     * @param emailLogsRepository - TypeORM repository for email log entities
     * @param brevoEmailProvider - Brevo transactional email adapter
     * @param configService - Nest config for environment-aware code exposure
     */
    constructor(
        @InjectRepository(EmailLog)
        private readonly emailLogsRepository: Repository<EmailLog>,
        private readonly brevoEmailProvider: BrevoEmailProvider,
        private readonly configService: ConfigService,
    ) { }

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

    /**
     * Sends an email verification code via Brevo and records the attempt.
     *
     * @param params - Recipient, code, and correlation identifiers
     * @returns Created email log entity
     */
    async sendVerificationEmail(
        params: SendAuthCodeEmailParams,
    ): Promise<EmailLog> {
        const { htmlContent, textContent } = buildVerificationEmailContent(
            params.name,
            params.code,
        );

        return this.sendAndLog({
            ...params,
            subject: EMAIL_SUBJECTS.VERIFY_EMAIL,
            htmlContent,
            textContent,
        });
    }

    /**
     * Sends a password reset code via Brevo and records the attempt.
     *
     * @param params - Recipient, code, and correlation identifiers
     * @returns Created email log entity
     */
    async sendPasswordResetEmail(
        params: SendAuthCodeEmailParams,
    ): Promise<EmailLog> {
        const { htmlContent, textContent } = buildPasswordResetEmailContent(
            params.name,
            params.code,
        );

        return this.sendAndLog({
            ...params,
            subject: EMAIL_SUBJECTS.PASSWORD_RESET,
            htmlContent,
            textContent,
        });
    }

    /**
     * Whether one-time codes may be returned in API responses (non-production).
     *
     * @returns True when codes can be echoed for local testing
     */
    shouldExposeCodesInResponse(): boolean {
        const explicit = this.configService.get<string>('INCLUDE_EMAIL_CODES');
        if (explicit === 'true') {
            return true;
        }
        if (explicit === 'false') {
            return false;
        }
        return this.configService.get<string>('NODE_ENV') !== 'production';
    }

    /**
     * Delivers mail through Brevo (when configured) and persists an audit log.
     *
     * @param params - Send payload including subject and rendered bodies
     * @returns Created email log entity
     */
    private async sendAndLog(params: {
        userId: string;
        organizationId: string | null;
        email: string;
        subject: string;
        code: string;
        userCodeId: string;
        htmlContent: string;
        textContent: string;
        name: string;
    }): Promise<EmailLog> {
        try {
            const sendResult = await this.brevoEmailProvider.send({
                toEmail: params.email,
                toName: params.name,
                subject: params.subject,
                htmlContent: params.htmlContent,
                textContent: params.textContent,
            });

            if (sendResult.skipped) {
                this.logger.log(
                    LOG_MESSAGES.EMAIL.CODE_LOGGED_LOCALLY(params.email, params.code),
                );
            }

            return this.log({
                userId: params.userId,
                organizationId: params.organizationId ?? undefined,
                email: params.email,
                subject: params.subject,
                status: EmailLogStatus.SENT,
                providerMessageId: sendResult.messageId,
                userCodeId: params.userCodeId,
                metadata: sendResult.skipped
                    ? { delivery: 'skipped_brevo_unconfigured' }
                    : undefined,
            });
        } catch (error) {
            this.logger.error(LOG_MESSAGES.EMAIL.SEND_FAILED(params.email), error);

            await this.log({
                userId: params.userId,
                organizationId: params.organizationId ?? undefined,
                email: params.email,
                subject: params.subject,
                status: EmailLogStatus.FAILED,
                userCodeId: params.userCodeId,
            }).catch((logError) => {
                this.logger.error(LOG_MESSAGES.EMAIL.LOG_FAILED(params.email), logError);
            });

            throw error;
        }
    }
}
