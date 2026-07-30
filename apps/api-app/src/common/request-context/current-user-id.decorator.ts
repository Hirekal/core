import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithContext } from './request-context.guard';

/**
 * Extracts the temporary request userId (from x-user-id header).
 * Replace with real auth user after merge.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithContext>();
    return request.context.userId;
  },
);
