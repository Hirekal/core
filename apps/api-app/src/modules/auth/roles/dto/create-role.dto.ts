/**
 * @fileoverview Data transfer object for creating roles.
 * Defines required and optional fields for role records scoped to organizations.
 */

import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Payload for creating a new role.
 *
 * Used by role-management endpoints. Requires a role name. Optional
 * `organizationId` scopes the role to a tenant; omit or set null for
 * system-wide roles. Supports description, system-role flag, and metadata.
 */
export class CreateRoleDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
