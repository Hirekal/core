/**
 * @fileoverview Data transfer object for creating organizations.
 * Defines required and optional fields for new organization records.
 */

import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { OrganizationStatus } from '../../common/constants/auth.constants';

/**
 * Payload for creating a new organization.
 *
 * Used by organization-management endpoints. Requires a display name.
 * Optional `status` defaults at the service layer when omitted, and
 * `metadata` allows attaching arbitrary key-value data to the record.
 */
export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
