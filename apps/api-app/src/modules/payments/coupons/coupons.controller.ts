/**
 * @fileoverview HTTP endpoints for payment coupon codes.
 */
import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/common/decorators/auth.decorator';
import { SYSTEM_ROLES } from '../../auth/common/constants/auth.constants';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('Payments')
@Auth(SYSTEM_ROLES.ADMIN)
@Controller('payments/coupons')
export class CouponsController {
  private readonly logger = new Logger(CouponsController.name);

  constructor(private readonly couponsService: CouponsService) {}

  /*
   * Validates a promotion code against the local coupon catalog.
   */
  @Post('validate')
  @ApiOperation({ summary: 'Validate a coupon / promotion code' })
  async validate(@Body() dto: ValidateCouponDto) {
    try {
      return await this.couponsService.validatePromotionCode(dto.promotionCode);
    } catch (error) {
      this.logger.error(
        `validate coupon failed for code ${dto.promotionCode}`,
        error,
      );
      throw error;
    }
  }
}
