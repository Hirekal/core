/**
 * @fileoverview Data transfer object for updating users.
 * Extends create-user fields as partial updates with additional status and audit fields.
 */

import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UserStatus } from '../../common/constants/auth.constants';
import { CreateUserDto } from './create-user.dto';

/**
 * Payload for updating an existing user record.
 *
 * Inherits all fields from {@link CreateUserDto} as optional, except
 * `createdBy` which is omitted to prevent overwriting creation audit data.
 * Adds optional `status` for lifecycle changes and `updatedBy` for audit
 * tracking. Used by administrative user-management endpoints.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['createdBy'] as const),
) {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsUUID()
  updatedBy?: string;
}
