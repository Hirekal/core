import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithContext } from './request-context.guard';

/**
 * Extracts the temporary request organizationId (from x-organization-id header).
 * Replace with real auth org after merge.
 */
export const CurrentOrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithContext>();
    return request.context.organizationId;
  },
);
