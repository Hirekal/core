/**
 * @fileoverview Data transfer object for updating roles.
 * Provides partial updates to role records based on create fields.
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';

/**
 * Payload for updating an existing role.
 *
 * Inherits all fields from {@link CreateRoleDto} as optional, allowing
 * clients to submit only the properties they intend to change. Used by
 * role-management endpoints.
 */
export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
