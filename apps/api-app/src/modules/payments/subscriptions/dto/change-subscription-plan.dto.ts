/**
 * @fileoverview DTO for changing a subscription plan (upgrade or downgrade).
 */
import { IsUUID } from 'class-validator';

export class ChangeSubscriptionPlanDto {
  @IsUUID()
  priceId: string;
}
