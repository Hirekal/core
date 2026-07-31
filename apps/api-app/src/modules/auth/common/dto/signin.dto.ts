/**
 * @fileoverview Data transfer object for user authentication.
 * Validates credentials submitted to the sign-in endpoint.
 */

import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Payload for authenticating an existing user.
 *
 * Used by the sign-in endpoint to validate email and password credentials
 * before issuing access and refresh tokens.
 */
export class SigninDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password: string;
}
