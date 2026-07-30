/**
 * @fileoverview Data transfer object for creating email log records.
 * Captures outbound email metadata for auditing, delivery tracking, and
 * correlation with user codes and organizations.
 */

import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EmailLogStatus } from '../../common/constants/auth.constants';

/**
 * Payload for persisting a new email log entry.
 *
 * Used by the email service when recording sent messages. All fields except
 * `email` and `subject` are optional, allowing logs to be created with
 * varying levels of context depending on the sending workflow.
 */
export class CreateEmailLogDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsEmail()
  email: string;

  @IsString()
  subject: string;

  @IsOptional()
  @IsEnum(EmailLogStatus)
  status?: EmailLogStatus;

  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @IsOptional()
  @IsUUID()
  userCodeId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
