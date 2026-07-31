/**
 * @fileoverview Data transfer object for one-time code verification.
 * Validates email, code, and optional code type for auth flows such as
 * email confirmation and password reset.
 */

import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserCodeType } from '../constants/auth.constants';

/**
 * Payload for verifying a one-time code sent to a user's email.
 *
 * Used during signup confirmation, password reset, and other flows that
 * rely on emailed verification codes. The optional `type` field narrows
 * validation to a specific code purpose when multiple code types exist.
 */
export class VerifyCodeDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsEnum(UserCodeType)
  type?: UserCodeType;
}
