/**
 * @fileoverview Core authentication service.
 * Orchestrates signup, signin, token lifecycle, profile management, and password reset flows.
 */
import { JwtService } from '@nestjs/jwt';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from './users/users.service';
import { OrganizationService } from './organization/organization.service';
import { RolesService } from './roles/roles.service';
import { UserRolesService } from './users/user-roles/user-roles.service';
import { UserSessionsService } from './users/user-sessions/user-sessions.service';
import { UserCodesService } from './users/user-codes/user-codes.service';
import { EmailsService } from './emails/emails.service';
import { SignupDto } from './common/dto/signup.dto';
import { SigninDto } from './common/dto/signin.dto';
import { UpdateProfileDto } from './common/dto/update-profile.dto';
import { ForgotPasswordDto } from './common/dto/forgot-password.dto';
import { ResendVerificationDto } from './common/dto/resend-verification.dto';
import { ChangePasswordDto } from './common/dto/change-password.dto';
import { VerifyCodeDto } from './common/dto/verify-code.dto';
import { ResetPasswordDto } from './common/dto/reset-password.dto';
import {
  AUTH_CONSTANTS,
  OrganizationStatus,
  SYSTEM_ROLES,
  UserCodeType,
  UserStatus,
} from './common/constants/auth.constants';
import {
  comparePassword,
  generateToken,
  hashToken,
} from './common/utils/hash.util';
import { User } from './users/entities/user.entity';
import { JwtPayload } from './common/strategies/jwt.strategy';
import { AUTH_MODULE_OPTIONS } from './common/interfaces/auth-module-options.interface';
import type { AuthModuleOptions } from './common/interfaces/auth-module-options.interface';
import { AuthTokensResponse } from './common/interfaces/auth-response.interface';
import type {
  ForgotPasswordResponse,
  MessageResponse,
  ResendVerificationResponse,
  SigninResponse,
  SignupResponse,
  UpdateProfilePatch,
  VerifyCodeResponse,
} from './common/interfaces/auth-service.interface';
import {
  ERROR_MESSAGES,
  LOG_MESSAGES,
  ROLE_DESCRIPTIONS,
  SUCCESS_MESSAGES,
} from './common/constants/messages';
import {
  DEFAULT_JWT_EXPIRY_FALLBACK_MS,
  JWT_EXPIRY_MULTIPLIERS_MS,
  JWT_EXPIRY_REGEX,
  ORGANIZATION_NAME_SUFFIX,
} from './common/constants/app.constants';
import { addMs, isBeforeNow } from './common/utils/date.util';
import { logServiceError } from '../../common/utils/error.util';

/**
 * Coordinates authentication workflows across users, sessions, roles, and email verification.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Creates the auth service with injected domain and JWT dependencies.
   *
   * @param usersService - User persistence and lookup
   * @param organizationService - Organization creation and lookup
   * @param rolesService - Role creation and lookup
   * @param userRolesService - User-to-role assignment
   * @param userSessionsService - Session and refresh token management
   * @param userCodesService - Verification and reset code handling
   * @param emailsService - Outbound email delivery and logging
   * @param jwtService - JWT signing
   * @param authOptions - Module-level auth configuration
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly organizationService: OrganizationService,
    private readonly rolesService: RolesService,
    private readonly userRolesService: UserRolesService,
    private readonly userSessionsService: UserSessionsService,
    private readonly userCodesService: UserCodesService,
    private readonly emailsService: EmailsService,
    private readonly jwtService: JwtService,
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  /**
   * Registers a new user, organization, and admin role assignment.
   *
   * Sends a verification email via Brevo. One-time codes are only echoed in
   * the response outside production (or when INCLUDE_EMAIL_CODES=true).
   *
   * @param dto - Signup payload with name, email, and password
   * @returns Created user, organization, and optional verification code
   */
  async signup(dto: SignupDto): Promise<SignupResponse> {
    try {
      const existing = await this.usersService.findByEmail(dto.email);
      if (existing) {
        if (existing.emailVerified) {
          throw new ConflictException(
            ERROR_MESSAGES.AUTH.EMAIL_ALREADY_REGISTERED,
          );
        }

        const code = await this.issueAndSendVerificationEmail(existing);

        return {
          user: existing,
          message: SUCCESS_MESSAGES.AUTH.VERIFICATION_CODE_SENT,
          ...(this.emailsService.shouldExposeCodesInResponse()
            ? { verificationCode: code }
            : {}),
        };
      }

      const organization = await this.organizationService.create({
        name: `${dto.name}${ORGANIZATION_NAME_SUFFIX}`,
        status: OrganizationStatus.ACTIVE,
        metadata: dto.metadata,
      });

      let adminRole = await this.rolesService.findByName(
        SYSTEM_ROLES.ADMIN,
        null,
      );
      if (!adminRole) {
        adminRole = await this.rolesService.create({
          name: SYSTEM_ROLES.ADMIN,
          description: ROLE_DESCRIPTIONS.ADMIN,
          isSystem: true,
          organizationId: null,
        });
      }

      const user = await this.usersService.create(
        {
          name: dto.name,
          email: dto.email,
          password: dto.password,
          emailVerified: false,
          metadata: dto.metadata,
        },
        organization.id,
      );

      await this.userRolesService.assign(user.id, adminRole.id);

      const code = await this.issueAndSendVerificationEmail(user);

      return {
        user,
        organization,
        message: SUCCESS_MESSAGES.AUTH.VERIFICATION_CODE_SENT,
        ...(this.emailsService.shouldExposeCodesInResponse()
          ? { verificationCode: code }
          : {}),
      };
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.SIGNUP_FAILED(dto.email),
        error,
      );
      throw error;
    }
  }

  /**
   * Authenticates a user and issues access and refresh tokens.
   *
   * @param dto - Signin payload with email and password
   * @param ipAddress - Optional client IP for session tracking
   * @returns Sanitized user and issued tokens
   */
  async signin(dto: SigninDto, ipAddress?: string): Promise<SigninResponse> {
    try {
      const user = await this.usersService.findByEmail(dto.email, true);
      if (!user) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS,
        );
      }

      const valid = await comparePassword(dto.password, user.password);
      if (!valid) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS,
        );
      }

      if (user.status === UserStatus.INACTIVE) {
        throw new UnauthorizedException(ERROR_MESSAGES.AUTH.ACCOUNT_INACTIVE);
      }

      if (!user.emailVerified) {
        throw new UnauthorizedException(ERROR_MESSAGES.AUTH.EMAIL_NOT_VERIFIED);
      }

      await this.usersService.updateLastLogin(user.id);
      const tokens = await this.issueTokens(user, ipAddress);

      return {
        user: this.usersService.sanitize(user),
        ...tokens,
      };
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.SIGNIN_FAILED(dto.email),
        error,
      );
      throw error;
    }
  }

  /**
   * Revokes the current or all sessions for a user.
   *
   * @param userId - Authenticated user identifier
   * @param refreshToken - Optional refresh token to revoke a single session
   * @returns Success message
   */
  async logout(
    userId: string,
    refreshToken?: string,
  ): Promise<MessageResponse> {
    try {
      if (refreshToken) {
        const session = await this.userSessionsService.findByRefreshTokenHash(
          hashToken(refreshToken),
        );
        if (session && session.userId === userId) {
          this.logger.log(
            LOG_MESSAGES.AUTH.REFRESH_REVOKED_ON_LOGOUT(userId, session.id),
          );
          await this.userSessionsService.revoke(session.id);
          return { message: SUCCESS_MESSAGES.AUTH.LOGGED_OUT };
        }
        this.logger.warn(LOG_MESSAGES.AUTH.LOGOUT_TOKEN_MISMATCH(userId));
      } else {
        this.logger.log(LOG_MESSAGES.AUTH.REVOKING_ALL_SESSIONS(userId));
      }
      await this.userSessionsService.revokeByUserId(userId);
      return { message: SUCCESS_MESSAGES.AUTH.LOGGED_OUT };
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.LOGOUT_FAILED(userId),
        error,
      );
      throw error;
    }
  }

  /**
   * Exchanges a valid refresh token for a new access and refresh token pair.
   *
   * @param refreshToken - Opaque refresh token from the client
   * @param ipAddress - Optional client IP for the new session
   * @returns Newly issued tokens
   */
  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
  ): Promise<AuthTokensResponse> {
    try {
      const session = await this.userSessionsService.findByRefreshTokenHash(
        hashToken(refreshToken),
      );

      if (!session) {
        this.logger.warn(LOG_MESSAGES.AUTH.REFRESH_REJECTED);
        throw new UnauthorizedException(
          ERROR_MESSAGES.AUTH.INVALID_REFRESH_TOKEN,
        );
      }

      if (isBeforeNow(session.refreshTokenExpiresAt)) {
        this.logger.warn(
          LOG_MESSAGES.AUTH.REFRESH_EXPIRED(session.userId, session.id),
        );
        throw new UnauthorizedException(
          ERROR_MESSAGES.AUTH.INVALID_REFRESH_TOKEN,
        );
      }

      this.logger.log(
        LOG_MESSAGES.AUTH.REFRESH_ACCEPTED(session.userId, session.id),
      );
      const user = await this.usersService.findOne(session.userId);
      await this.userSessionsService.revoke(session.id);
      this.logger.log(
        LOG_MESSAGES.AUTH.OLD_SESSION_REVOKED(session.userId, session.id),
      );
      return this.issueTokens(user, ipAddress);
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.REFRESH_FLOW_FAILED,
        error,
      );
      throw error;
    }
  }

  /**
   * Returns the profile for an authenticated user.
   *
   * @param userId - Authenticated user identifier
   * @returns Sanitized user profile
   */
  async getProfile(userId: string): Promise<User> {
    try {
      return this.usersService.findOne(userId);
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.GET_PROFILE_FAILED(userId),
        error,
      );
      throw error;
    }
  }

  /**
   * Updates profile fields for an authenticated user.
   *
   * @param userId - Authenticated user identifier
   * @param dto - Partial profile update payload
   * @returns Updated sanitized user profile
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    try {
      const profilePatch: UpdateProfilePatch = { updatedBy: userId };

      if (dto.name !== undefined) profilePatch.name = dto.name;
      if (dto.metadata !== undefined) profilePatch.metadata = dto.metadata;

      await this.usersService.update(userId, profilePatch);
      return this.usersService.findOne(userId);
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.UPDATE_PROFILE_FAILED(userId),
        error,
      );
      throw error;
    }
  }

  /**
   * Changes the authenticated user's password after verifying the current one.
   *
   * Revokes all sessions so clients must sign in again with the new password.
   *
   * @param userId - Authenticated user identifier
   * @param dto - Current and new password payload
   * @returns Success message
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<MessageResponse> {
    try {
      const user = await this.usersService.findByEmail(
        (await this.usersService.findOne(userId)).email,
        true,
      );
      if (!user) {
        throw new BadRequestException(ERROR_MESSAGES.USER.NOT_FOUND);
      }

      const valid = await comparePassword(dto.currentPassword, user.password);
      if (!valid) {
        throw new BadRequestException(
          ERROR_MESSAGES.AUTH.CURRENT_PASSWORD_INCORRECT,
        );
      }

      await this.usersService.update(userId, {
        password: dto.newPassword,
        updatedBy: userId,
      });
      await this.userSessionsService.revokeByUserId(userId);

      return { message: SUCCESS_MESSAGES.AUTH.PASSWORD_CHANGED };
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.CHANGE_PASSWORD_FAILED(userId),
        error,
      );
      throw error;
    }
  }

  /**
   * Resends an email verification code for an unverified account.
   *
   * Always returns a generic success message to avoid email enumeration.
   *
   * @param dto - Resend payload with email
   * @returns Generic success message and optional verification code
   */
  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<ResendVerificationResponse> {
    try {
      const user = await this.usersService.findByEmail(dto.email);
      if (!user || user.emailVerified) {
        return { message: SUCCESS_MESSAGES.AUTH.VERIFICATION_CODE_SENT };
      }

      const code = await this.issueAndSendVerificationEmail(user);

      return {
        message: SUCCESS_MESSAGES.AUTH.VERIFICATION_CODE_SENT,
        ...(this.emailsService.shouldExposeCodesInResponse()
          ? { verificationCode: code }
          : {}),
      };
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.RESEND_VERIFICATION_FAILED(dto.email),
        error,
      );
      throw error;
    }
  }

  /**
   * Initiates a password reset by generating and emailing a reset code.
   *
   * @param dto - Forgot password payload with email
   * @returns Generic success message and optional reset code
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    try {
      const user = await this.usersService.findByEmail(dto.email);
      if (!user) {
        return { message: SUCCESS_MESSAGES.AUTH.RESET_CODE_SENT };
      }

      const { code, entity } = await this.userCodesService.create(
        user.id,
        UserCodeType.PASSWORD_RESET,
      );

      await this.emailsService.sendPasswordResetEmail({
        userId: user.id,
        organizationId: user.organizationId,
        email: user.email,
        name: user.name,
        code,
        userCodeId: entity.id,
      });

      return {
        message: SUCCESS_MESSAGES.AUTH.RESET_CODE_SENT,
        ...(this.emailsService.shouldExposeCodesInResponse()
          ? { resetCode: code }
          : {}),
      };
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.FORGOT_PASSWORD_FAILED(dto.email),
        error,
      );
      throw error;
    }
  }

  /**
   * Verifies a one-time code for email verification or password reset.
   *
   * @param dto - Verification payload with email, code, and type
   * @returns Success message and verified code type
   */
  async verifyCode(dto: VerifyCodeDto): Promise<VerifyCodeResponse> {
    try {
      const user = await this.usersService.findByEmail(dto.email);
      if (!user) {
        throw new BadRequestException(
          ERROR_MESSAGES.AUTH.INVALID_VERIFICATION_REQUEST,
        );
      }

      const verified = await this.userCodesService.verify(
        user.id,
        dto.code,
        dto.type,
        false,
      );

      if (verified.type === UserCodeType.EMAIL_VERIFICATION) {
        await this.userCodesService.markVerified(verified.id);
        await this.usersService.update(user.id, {
          emailVerified: true,
          status: UserStatus.ACTIVE,
          updatedBy: user.id,
        });
      }

      return {
        message: SUCCESS_MESSAGES.AUTH.CODE_VERIFIED,
        type: verified.type,
      };
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.VERIFY_CODE_FAILED(dto.email),
        error,
      );
      throw error;
    }
  }

  /**
   * Resets a user's password after validating a reset code.
   *
   * @param dto - Reset password payload with email, code, and new password
   * @returns Success message
   */
  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponse> {
    try {
      const user = await this.usersService.findByEmail(dto.email, true);
      if (!user) {
        throw new BadRequestException(
          ERROR_MESSAGES.AUTH.INVALID_RESET_REQUEST,
        );
      }

      await this.userCodesService.verify(
        user.id,
        dto.code,
        UserCodeType.PASSWORD_RESET,
      );

      await this.usersService.update(user.id, {
        password: dto.newPassword,
        updatedBy: user.id,
      });

      await this.userSessionsService.revokeByUserId(user.id);

      return { message: SUCCESS_MESSAGES.AUTH.PASSWORD_RESET };
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.RESET_PASSWORD_FAILED(dto.email),
        error,
      );
      throw error;
    }
  }

  /**
   * Creates a verification code and delivers it through Brevo.
   *
   * @param user - User receiving the verification email
   * @returns Plaintext verification code
   */
  private async issueAndSendVerificationEmail(user: User): Promise<string> {
    const { code, entity } = await this.userCodesService.create(
      user.id,
      UserCodeType.EMAIL_VERIFICATION,
    );

    await this.emailsService.sendVerificationEmail({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      code,
      userCodeId: entity.id,
    });

    return code;
  }

  /**
   * Signs JWT access and refresh tokens and persists a new session.
   *
   * @param user - Authenticated user entity
   * @param ipAddress - Optional client IP for session tracking
   * @returns Access and refresh tokens with expiry timestamps
   */
  private async issueTokens(
    user: User,
    ipAddress?: string,
  ): Promise<AuthTokensResponse> {
    try {
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        organizationId: user.organizationId,
      };

      const refreshExpiresIn =
        this.authOptions.jwtRefreshExpiresIn ??
        AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN;

      const accessExpiresIn =
        this.authOptions.jwtAccessExpiresIn ??
        AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN;

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: this.authOptions.jwtSecret,
        expiresIn: accessExpiresIn as
          number | `${number}${'s' | 'm' | 'h' | 'd'}`,
      });

      const accessTokenExpiresAt = addMs(
        this.resolveExpiresMs(accessExpiresIn),
      );
      this.logger.log(
        LOG_MESSAGES.AUTH.ACCESS_TOKEN_ISSUED(
          user.id,
          accessTokenExpiresAt.toISOString(),
        ),
      );

      const refreshToken = generateToken(48);
      const refreshTokenExpiresAt = addMs(
        this.resolveExpiresMs(refreshExpiresIn),
      );
      this.logger.log(
        LOG_MESSAGES.AUTH.REFRESH_TOKEN_ISSUED(
          user.id,
          refreshTokenExpiresAt.toISOString(),
        ),
      );

      await this.userSessionsService.create({
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        accessTokenHash: hashToken(accessToken),
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        ipAddress,
      });

      return {
        accessToken,
        refreshToken,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
      };
    } catch (error) {
      logServiceError(
        this.logger,
        LOG_MESSAGES.AUTH.ISSUE_TOKENS_FAILED(user.id),
        error,
      );
      throw error;
    }
  }

  /**
   * Converts JWT expiry configuration into milliseconds.
   *
   * Supports numeric seconds or suffixed strings (`s`, `m`, `h`, `d`).
   * Falls back to 15 minutes when the format is invalid.
   *
   * @param expiresIn - JWT expiry value from configuration
   * @returns Expiry duration in milliseconds
   */
  private resolveExpiresMs(expiresIn: string | number): number {
    if (typeof expiresIn === 'number') {
      return expiresIn * 1000;
    }

    /*
     * Pattern: /^(\d+)([smhd])$/
     * Group 1: numeric duration
     * Group 2: unit — s=seconds, m=minutes, h=hours, d=days
     */
    const match = JWT_EXPIRY_REGEX.exec(expiresIn);
    if (!match) {
      return DEFAULT_JWT_EXPIRY_FALLBACK_MS;
    }

    const durationValue = Number(match[1]);
    const durationUnit = match[2];
    return durationValue * JWT_EXPIRY_MULTIPLIERS_MS[durationUnit];
  }
}
