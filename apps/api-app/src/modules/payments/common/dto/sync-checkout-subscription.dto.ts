/**
 * @fileoverview DTO for syncing a subscription after custom checkout payment.
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SyncCheckoutSubscriptionDto {
  @IsString()
  @MaxLength(255)
  providerSubscriptionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerPaymentId?: string;
}
