/**
 * @fileoverview Global JWT authentication guard.
 * Validates bearer tokens, supports silent refresh via X-Refresh-Token, and skips @Public routes.
 */
import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from '../../auth.service';
import { logServiceError } from '../../../../common/utils/error.util';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { HTTP_HEADERS } from '../constants/app.constants';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../constants/messages';

/**
 * Passport-backed guard that protects routes unless marked @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly authService: AuthService,
  ) {
    super();
  }

  /**
   * Authorizes the request or attempts token refresh when the access token expired.
   *
   * @param context - Nest execution context for the incoming HTTP request
   * @returns True when the request is authorized
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const isPublic = this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (isPublic) {
        return true;
      }

      if (await this.tryActivate(context)) {
        return true;
      }

      const request = context.switchToHttp().getRequest<Request>();
      const response = context.switchToHttp().getResponse<Response>();
      const refreshToken = this.extractRefreshToken(request);

      if (!refreshToken) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.AUTH.INVALID_OR_MISSING_TOKEN,
        );
      }

      this.logger.log(LOG_MESSAGES.GUARD.ACCESS_TOKEN_EXPIRED);
      const tokens = await this.authService.refreshToken(
        refreshToken,
        request.ip,
      );

      request.headers.authorization = `Bearer ${tokens.accessToken}`;
      request.headers[HTTP_HEADERS.REFRESH_TOKEN.toLowerCase()] =
        tokens.refreshToken;
      response.setHeader(
        HTTP_HEADERS.AUTHORIZATION,
        `Bearer ${tokens.accessToken}`,
      );
      response.setHeader(HTTP_HEADERS.REFRESH_TOKEN, tokens.refreshToken);
      response.setHeader(
        HTTP_HEADERS.ACCESS_TOKEN_EXPIRES_AT,
        tokens.accessTokenExpiresAt.toISOString(),
      );
      response.setHeader(
        HTTP_HEADERS.REFRESH_TOKEN_EXPIRES_AT,
        tokens.refreshTokenExpiresAt.toISOString(),
      );

      if (await this.tryActivate(context)) {
        this.logger.log(LOG_MESSAGES.GUARD.AUTO_REFRESH_SUCCEEDED);
        return true;
      }

      throw new UnauthorizedException(
        ERROR_MESSAGES.AUTH.INVALID_OR_MISSING_TOKEN,
      );
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.GUARD.CAN_ACTIVATE_FAILED,
        error,
      );
      throw error;
    }
  }

  /**
   * Attempts standard Passport JWT activation without throwing.
   *
   * @param context - Nest execution context
   * @returns True when Passport successfully authenticated the request
   */
  private async tryActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = await super.canActivate(context);
      return result === true;
    } catch {
      return false;
    }
  }

  /**
   * Reads the refresh token from the X-Refresh-Token request header.
   *
   * @param request - Incoming HTTP request
   * @returns Refresh token when present
   */
  private extractRefreshToken(request: Request): string | undefined {
    const header = request.headers[HTTP_HEADERS.REFRESH_TOKEN.toLowerCase()];
    return typeof header === 'string' && header.length > 0 ? header : undefined;
  }

  /**
   * Normalizes Passport authentication failures into Nest unauthorized errors.
   *
   * @param err - Optional authentication error
   * @param user - Authenticated user when available
   * @param info - Additional Passport metadata
   * @returns Authenticated user payload attached to the request
   */
  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: Error | null,
  ): TUser {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          info?.message || ERROR_MESSAGES.AUTH.INVALID_OR_MISSING_TOKEN,
        )
      );
    }
    return user;
  }
}
