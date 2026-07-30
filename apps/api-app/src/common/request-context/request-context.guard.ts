import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestContext } from './request-context.types';

export interface RequestWithContext extends Request {
  context: RequestContext;
}

/**
 * Temporary tenant-scoping guard for the jobs branch.
 *
 * Reads `x-user-id` and `x-organization-id` so jobs APIs can filter by org
 * until the real auth module (JWT / session) is merged from the other branch.
 * This is NOT login/signup and does NOT validate tokens.
 */
@Injectable()
export class RequestContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const userId = request.headers['x-user-id'];
    const organizationId = request.headers['x-organization-id'];

    if (
      typeof userId !== 'string' ||
      !userId ||
      typeof organizationId !== 'string' ||
      !organizationId
    ) {
      throw new BadRequestException(
        'Missing x-user-id or x-organization-id headers (temporary until auth merge)',
      );
    }

    request.context = { userId, organizationId };
    return true;
  }
}
