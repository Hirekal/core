/**
 * @fileoverview DTO for creating a coupon and matching Stripe promotion code.
 */
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  CouponDiscountType,
  CouponDuration,
} from '../../common/enums/payment.enums';

export class CreateCouponDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  /** Customer-facing code (case-insensitive; stored uppercase). */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'promotionCode may only contain letters, numbers, and hyphens',
  })
  promotionCode: string;

  @IsEnum(CouponDiscountType)
  discountType: CouponDiscountType;

  /** Percentage 1–100, or fixed amount in major currency units (e.g. 10 = $10). */
  @IsInt()
  @Min(1)
  discountValue: number;

  @IsEnum(CouponDuration)
  duration: CouponDuration;

  /** Required when duration is REPEATING. Stored in metadata for Stripe sync. */
  @ValidateIf((dto: CreateCouponDto) => dto.duration === CouponDuration.REPEATING)
  @IsInt()
  @Min(1)
  durationInMonths?: number;

  /** Required when discountType is FIXED (major units currency, e.g. USD). */
  @ValidateIf((dto: CreateCouponDto) => dto.discountType === CouponDiscountType.FIXED)
  @IsString()
  @MinLength(3)
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maximumRedemptions?: number | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
