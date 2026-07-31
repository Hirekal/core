/**
 * @fileoverview Data transfer object for updating organizations.
 * Provides partial updates to organization records based on create fields.
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';

/**
 * Payload for updating an existing organization.
 *
 * Inherits all fields from {@link CreateOrganizationDto} as optional,
 * allowing clients to submit only the properties they intend to change.
 * Used by organization-management endpoints.
 */
export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
