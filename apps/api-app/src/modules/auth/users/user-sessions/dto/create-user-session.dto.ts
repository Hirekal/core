/**
 * @fileoverview Data transfer object for creating user session records.
 * Defines the shape of session data persisted when tokens are issued.
 */

import { IsOptional, IsString, IsUUID, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Payload for persisting a new authenticated user session.
 *
 * Used internally when issuing tokens to store hashed token values, expiry
 * timestamps, and optional request context such as IP address and metadata.
 * Not typically exposed directly to API clients.
 */
export class CreateUserSessionDto {
  @IsUUID()
  userId: string;

  @IsString()
  refreshTokenHash: string;

  @IsString()
  accessTokenHash: string;

  @Type(() => Date)
  accessTokenExpiresAt: Date;

  @Type(() => Date)
  refreshTokenExpiresAt: Date;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
