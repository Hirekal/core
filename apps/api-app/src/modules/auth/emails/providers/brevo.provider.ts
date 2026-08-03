/**
 * @fileoverview Brevo transactional email client wrapper.
 * Sends outbound messages via the Brevo SMTP API using the official SDK.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';
import { LOG_MESSAGES } from '../../common/constants/messages';

export interface SendBrevoEmailParams {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface SendBrevoEmailResult {
  messageId?: string;
  skipped: boolean;
}

/**
 * Thin adapter around BrevoClient for transactional email delivery.
 */
@Injectable()
export class BrevoEmailProvider {
  private readonly logger = new Logger(BrevoEmailProvider.name);
  private readonly client: BrevoClient | null;
  private readonly senderEmail: string;
  private readonly senderName: string;

  /**
   * Creates the Brevo provider from environment configuration.
   *
   * When `BREVO_API_KEY` is missing, sends are skipped so local development
   * can continue without a live provider.
   *
   * @param configService - Nest config for Brevo credentials and sender
   */
  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY')?.trim();
    this.senderEmail =
      this.configService.get<string>('BREVO_SENDER_EMAIL')?.trim() ?? '';
    this.senderName =
      this.configService.get<string>('BREVO_SENDER_NAME')?.trim() ?? 'Hirekal';

    if (apiKey && this.senderEmail) {
      this.client = new BrevoClient({ apiKey });
    } else {
      this.client = null;
      this.logger.warn(LOG_MESSAGES.EMAIL.BREVO_NOT_CONFIGURED);
    }
  }

  /**
   * Sends a transactional email through Brevo.
   *
   * @param params - Recipient, subject, and HTML/text body
   * @returns Provider message id when sent, or `{ skipped: true }` when unset
   */
  async send(params: SendBrevoEmailParams): Promise<SendBrevoEmailResult> {
    if (!this.client) {
      this.logger.warn(
        LOG_MESSAGES.EMAIL.BREVO_SEND_SKIPPED(params.toEmail, params.subject),
      );
      return { skipped: true };
    }

    try {
      const result = await this.client.transactionalEmails.sendTransacEmail({
        subject: params.subject,
        htmlContent: params.htmlContent,
        textContent: params.textContent,
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [
          {
            email: params.toEmail,
            name: params.toName,
          },
        ],
      });

      return {
        messageId: result.messageId,
        skipped: false,
      };
    } catch (error) {
      this.logger.error(
        LOG_MESSAGES.EMAIL.BREVO_SEND_FAILED(params.toEmail, params.subject),
        error,
      );
      throw error;
    }
  }
}
