/**
 * @fileoverview DTO for canceling a subscription.
 */
import { IsBoolean, IsOptional } from 'class-validator';

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;
}
