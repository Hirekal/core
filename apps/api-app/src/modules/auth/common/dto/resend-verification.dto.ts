/**
 * @fileoverview Data transfer object for resending email verification codes.
 */
import { IsEmail, MaxLength } from 'class-validator';

/**
 * Payload for requesting a new email verification code.
 */
export class ResendVerificationDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}
