/**
 * @fileoverview DTO for changing a subscription plan (upgrade or downgrade).
 */
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ChangeSubscriptionPlanDto {
  @IsUUID()
  priceId: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(100)
  couponCode?: string;
}
