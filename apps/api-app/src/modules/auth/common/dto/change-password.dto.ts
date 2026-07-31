/**
 * @fileoverview Data transfer object for authenticated password changes.
 */
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Payload for changing the authenticated user's password.
 *
 * Requires the current password for verification before applying the new one.
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  newPassword: string;
}
