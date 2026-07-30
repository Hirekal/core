/**
 * @fileoverview Data transfer object for authenticated profile updates.
 * Defines the shape and validation rules for self-service profile changes.
 */

import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AtLeastOneField } from '../validators/at-least-one-field.validator';

/**
 * Payload for updating the authenticated user's own profile.
 *
 * At least one of `name` or `metadata` must be provided.
 * Password changes use `POST /auth/change-password` instead.
 */
export class UpdateProfileDto {
  @AtLeastOneField(['name', 'metadata'])
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
