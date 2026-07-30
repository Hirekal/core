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
import { toErrorMessage } from '../../common/utils/error.util';

@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    /**
     * Creates the auth controller with the injected auth service.
     *
     * @param authService - Authentication business logic
     */
    constructor(private readonly authService: AuthService) { }

    /**
     * Registers a new account and sends an email verification code.
     *
     * @param dto - Signup payload
     * @returns Created user (and org for new accounts)
     */
    @Public()
    @Post('signup')
    async signup(@Body() dto: SignupDto) {
        try {
            return await this.authService.signup(dto);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_SIGNUP_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Authenticates a verified user and issues access/refresh tokens.
     *
     * @param dto - Signin credentials
     * @param req - Incoming HTTP request (for client IP)
     * @returns User profile and tokens
     */
    @Public()
    @Post('signin')
    @HttpCode(HttpStatus.OK)
    async signin(@Body() dto: SigninDto, @Req() req: Request) {
        try {
            return await this.authService.signin(dto, req.ip);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_SIGNIN_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Revokes the current session (or all sessions when no refresh token is sent).
     *
     * @param user - Authenticated user from JWT
     * @param body - Optional refresh token to revoke a single session
     * @returns Logout confirmation message
     */
    @Auth()
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@CurrentUser() user: User, @Body() body: RefreshTokenDto) {
        try {
            return await this.authService.logout(user.id, body?.refreshToken);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_LOGOUT_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Exchanges a refresh token for a new access/refresh pair.
     *
     * @param dto - Refresh token payload
     * @param req - Incoming HTTP request (for client IP)
     * @returns Newly issued tokens
     */
    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
        try {
            return await this.authService.refreshToken(dto.refreshToken, req.ip);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_REFRESH_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Returns the authenticated user's profile.
     *
     * @param user - Authenticated user from JWT
     * @returns Sanitized user profile
     */
    @Auth()
    @Get('profile')
    async getProfile(@CurrentUser() user: User) {
        try {
            return await this.authService.getProfile(user.id);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_PROFILE_GET_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Updates the authenticated user's profile (name/metadata).
     *
     * @param user - Authenticated user from JWT
     * @param dto - Profile fields to update
     * @returns Updated sanitized profile
     */
    @Auth()
    @Patch('profile')
    async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
        try {
            this.logger.log(
                LOG_MESSAGES.AUTH.PROFILE_PATCH_REQUEST(user.id, JSON.stringify(dto)),
            );
            return await this.authService.updateProfile(user.id, dto);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_PROFILE_PATCH_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Changes the authenticated user's password using the current password.
     *
     * @param user - Authenticated user from JWT
     * @param dto - Current and new password
     * @returns Success message
     */
    @Auth()
    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    async changePassword(
        @CurrentUser() user: User,
        @Body() dto: ChangePasswordDto,
    ) {
        try {
            return await this.authService.changePassword(user.id, dto);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_CHANGE_PASSWORD_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Starts password reset by emailing a one-time code.
     *
     * @param dto - Email payload
     * @returns Generic success message
     */
    @Public()
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        try {
            return await this.authService.forgotPassword(dto);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_FORGOT_PASSWORD_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Resends an email verification code for an unverified account.
     *
     * @param dto - Email payload
     * @returns Generic success message
     */
    @Public()
    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    async resendVerification(@Body() dto: ResendVerificationDto) {
        try {
            return await this.authService.resendVerification(dto);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_RESEND_VERIFICATION_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Verifies a one-time email or password-reset code.
     *
     * @param dto - Email, code, and code type
     * @returns Verification result
     */
    @Public()
    @Post('verify-code')
    @HttpCode(HttpStatus.OK)
    async verifyCode(@Body() dto: VerifyCodeDto) {
        try {
            return await this.authService.verifyCode(dto);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_VERIFY_CODE_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Resets a password after validating a reset code.
     *
     * @param dto - Email, code, and new password
     * @returns Success message
     */
    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        try {
            return await this.authService.resetPassword(dto);
        } catch (error) {
            this.logger.error(
                `${LOG_MESSAGES.CONTROLLER.AUTH_RESET_PASSWORD_FAILED}: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
}
