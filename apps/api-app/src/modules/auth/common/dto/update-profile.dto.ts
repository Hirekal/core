/**
 * @fileoverview Data transfer object for authenticated profile updates.
 * Defines the shape and validation rules for self-service profile changes.
 */

import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AtLeastOneField } from '../validators/at-least-one-field.validator';

/**
 * Payload for updating the authenticated user's own profile.
 *
 * At least one of `name`, `password`, or `metadata` must be provided.
 * Used by profile endpoints where the caller updates their account without
 * requiring admin privileges.
 */
export class UpdateProfileDto {
  @AtLeastOneField(['name', 'password', 'metadata'])
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
