/**
 * @fileoverview DTO for validating a promotion / coupon code.
 */
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ValidateCouponDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  promotionCode: string;
}
