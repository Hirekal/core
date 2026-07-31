/**
 * @fileoverview Data transfer object for completing password recovery.
 * Validates the reset code and new password submitted after a forgot-password request.
 */

import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Payload for resetting a user's password with a verification code.
 *
 * Used by the reset-password endpoint after the user receives a code via
 * the forgot-password flow. Requires the account email, the one-time code,
 * and a new password meeting minimum length requirements.
 */
export class ResetPasswordDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  newPassword: string;
}
