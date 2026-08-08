import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import type { SystemRole } from '../constants/auth.constants';

export const ROLES_KEY = 'roles';

/**
 * Marks a route as requiring one of the given system roles.
 */
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Protects a route with JWT auth and optional role checks.
 */
export function Auth(...roles: SystemRole[]) {
  if (roles.length === 0) {
    return applyDecorators(UseGuards(JwtAuthGuard));
  }

  return applyDecorators(
    Roles(...roles),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
}
