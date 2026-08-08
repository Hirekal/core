/**
 * @fileoverview Role-based authorization guard.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/auth.decorator';
import type { SystemRole } from '../constants/auth.constants';
import type { User } from '../../users/entities/user.entity';
import { ERROR_MESSAGES } from '../constants/messages';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    const roleNames = (user?.userRoles ?? [])
      .map((userRole) => userRole.role?.name)
      .filter((name): name is string => Boolean(name));

    const hasRequiredRole = requiredRoles.some((role) =>
      roleNames.some(
        (name) => name.toLowerCase() === role.toLowerCase(),
      ),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(ERROR_MESSAGES.AUTH.FORBIDDEN);
    }

    return true;
  }
}
