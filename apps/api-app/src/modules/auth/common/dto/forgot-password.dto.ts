/**
 * @fileoverview Data transfer object for initiating password recovery.
 * Validates the email address used to request a reset code.
 */

import { IsEmail, MaxLength } from 'class-validator';

/**
 * Payload for requesting a password reset code.
 *
 * Used by the forgot-password endpoint. The server sends a one-time code
 * to the provided email if a matching account exists.
 */
export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}
