/**
 * @fileoverview Data transfer object for creating users.
 * Defines required and optional fields for admin or system-initiated user creation.
 */

import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SYSTEM_ROLES } from '../../common/constants/auth.constants';

const ASSIGNABLE_ROLES = [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.RECRUITER] as const;

/**
 * Payload for creating a new user record.
 *
 * Used by administrative user-management endpoints. Requires name, email, and
 * password. Optional fields support pre-verified accounts, audit tracking via
 * `createdBy`, and arbitrary client metadata.
 */
export class CreateUserDto {
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
  @IsBoolean()
  emailVerified?: boolean;

  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /** System role to assign (Admin or Recruiter). Defaults to Recruiter. */
  @IsOptional()
  @IsString()
  @IsIn(ASSIGNABLE_ROLES)
  role?: (typeof ASSIGNABLE_ROLES)[number];
}
