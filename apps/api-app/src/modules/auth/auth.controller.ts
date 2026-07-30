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
import { ForgotPasswordDto } from './common/dto/forgot-password.dto';
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

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  signin(@Body() dto: SigninDto, @Req() req: Request) {
    return this.authService.signin(dto, req.ip);
  }

  @Auth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: User, @Body() body: RefreshTokenDto) {
    return this.authService.logout(user.id, body?.refreshToken);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshToken(dto.refreshToken, req.ip);
  }

  @Auth()
  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  @Auth()
  @Patch('profile')
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    this.logger.log(
      LOG_MESSAGES.AUTH.PROFILE_PATCH_REQUEST(user.id, JSON.stringify(dto)),
    );
    return this.authService.updateProfile(user.id, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
