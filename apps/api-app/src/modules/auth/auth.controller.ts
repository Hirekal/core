/**
 * @fileoverview Authentication HTTP endpoints.
 * Exposes signup, signin, token refresh, profile, and password recovery routes.
 */
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './common/dto/signup.dto';
import { SigninDto } from './common/dto/signin.dto';
import { RefreshTokenDto } from './common/dto/refresh-token.dto';
import { UpdateProfileDto } from './common/dto/update-profile.dto';
import { ChangePasswordDto } from './common/dto/change-password.dto';
import { ForgotPasswordDto } from './common/dto/forgot-password.dto';
import { ResendVerificationDto } from './common/dto/resend-verification.dto';
import { VerifyCodeDto } from './common/dto/verify-code.dto';
import { ResetPasswordDto } from './common/dto/reset-password.dto';
import { Public } from './common/decorators/public.decorator';
import { Auth } from './common/decorators/auth.decorator';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { User } from './users/entities/user.entity';
import { LOG_MESSAGES } from './common/constants/messages';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  /**
   * Creates the auth controller with the injected auth service.
   *
   * @param authService - Authentication business logic
   */
  constructor(private readonly authService: AuthService) {}

  /** Registers a new account and sends an email verification code. */
  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  /** Authenticates a verified user and issues access/refresh tokens. */
  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  signin(@Body() dto: SigninDto, @Req() req: Request) {
    return this.authService.signin(dto, req.ip);
  }

  /** Revokes the current session (or all sessions when no refresh token is sent). */
  @Auth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: User, @Body() body: RefreshTokenDto) {
    return this.authService.logout(user.id, body?.refreshToken);
  }

  /** Exchanges a refresh token for a new access/refresh pair. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshToken(dto.refreshToken, req.ip);
  }

  /** Returns the authenticated user's profile. */
  @Auth()
  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  /** Updates the authenticated user's profile (name/metadata). */
  @Auth()
  @Patch('profile')
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    this.logger.log(
      LOG_MESSAGES.AUTH.PROFILE_PATCH_REQUEST(user.id, JSON.stringify(dto)),
    );
    return this.authService.updateProfile(user.id, dto);
  }

  /** Changes the authenticated user's password using the current password. */
  @Auth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  /** Starts password reset by emailing a one-time code. */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /** Resends an email verification code for an unverified account. */
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  /** Verifies a one-time email or password-reset code. */
  @Public()
  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto);
  }

  /** Resets a password after validating a reset code. */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
