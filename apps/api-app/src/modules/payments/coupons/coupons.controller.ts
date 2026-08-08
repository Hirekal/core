/**
 * @fileoverview HTTP endpoints for payment coupon codes.
 */
import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/common/decorators/auth.decorator';
import { Public } from '../../auth/common/decorators/public.decorator';
import { CurrentUser } from '../../auth/common/decorators/current-user.decorator';
import { User } from '../../auth/users/entities/user.entity';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('Payments')
@Controller('payments/coupons')
export class CouponsController {
  private readonly logger = new Logger(CouponsController.name);

  constructor(private readonly couponsService: CouponsService) {}

  /*
   * Creates a coupon locally and synchronizes Stripe coupon + promotion code.
   * Temporarily public for local/admin tooling; re-lock with Auth when ready.
   */
  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a coupon / promotion code' })
  async create(@Body() dto: CreateCouponDto) {
    try {
      return await this.couponsService.create(dto);
    } catch (error) {
      this.logger.error(
        `create coupon failed for code ${dto.promotionCode}`,
        error,
      );
      throw error;
    }
  }

  /*
   * Validates a promotion code against the local coupon catalog for the
   * authenticated organization's Stripe customer (per-customer once).
   */
  @Auth()
  @Post('validate')
  @ApiOperation({ summary: 'Validate a coupon / promotion code' })
  async validate(
    @CurrentUser() user: User,
    @Body() dto: ValidateCouponDto,
  ) {
    try {
      return await this.couponsService.validatePromotionCode(
        dto.promotionCode,
        user.organizationId,
      );
    } catch (error) {
      this.logger.error(
        `validate coupon failed for code ${dto.promotionCode}`,
        error,
      );
      throw error;
    }
  }
}
