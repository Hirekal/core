/**
 * @fileoverview Data transfer object for user registration.
 * Defines required and optional fields for creating a new account.
 */

import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Payload for registering a new user account.
 *
 * Used by the public signup endpoint. Requires a display name, valid email,
 * and password meeting minimum length requirements. Optional `metadata` allows
 * clients to attach arbitrary key-value data stored on the user record.
 */
export class SignupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
