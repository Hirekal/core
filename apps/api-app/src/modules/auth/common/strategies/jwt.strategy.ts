/**
 * @fileoverview Passport JWT validation strategy.
 * Validates bearer tokens against active user sessions before attaching req.user.
 */
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { UserSessionsService } from '../../users/user-sessions/user-sessions.service';
import { logServiceError } from '../../../../common/utils/error.util';
import { hashToken } from '../utils/hash.util';
import { AUTH_MODULE_OPTIONS } from '../interfaces/auth-module-options.interface';
import type { AuthModuleOptions } from '../interfaces/auth-module-options.interface';
import { ERROR_MESSAGES, LOG_MESSAGES } from '../constants/messages';

/**
 * JWT payload embedded in access tokens.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
}

/**
 * Passport strategy that binds JWT claims to an active session and user profile.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @Inject(AUTH_MODULE_OPTIONS)
    authOptions: AuthModuleOptions,
    private readonly usersService: UsersService,
    private readonly userSessionsService: UserSessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authOptions.jwtSecret,
      passReqToCallback: true,
    });
  }

  /**
   * Validates the JWT, confirms the session is active, and loads the user profile.
   *
   * @param req - Incoming HTTP request containing the bearer token
   * @param payload - Decoded JWT claims
   * @returns Authenticated user attached to the request
   */
  async validate(req: Request, payload: JwtPayload) {
    try {
      const extractToken = ExtractJwt.fromAuthHeaderAsBearerToken();
      const accessToken = extractToken(req);

      if (!accessToken) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.AUTH.INVALID_OR_MISSING_TOKEN,
        );
      }

      const session = await this.userSessionsService.findByAccessTokenHash(
        hashToken(accessToken),
      );

      if (!session || !this.userSessionsService.isSessionActive(session)) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.AUTH.SESSION_INVALID_OR_EXPIRED,
        );
      }

      await this.userSessionsService.touch(session.id);

      return await this.usersService.findOne(payload.sub);
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.STRATEGY.VALIDATE_FAILED,
        error,
      );
      throw error;
    }
  }
}
