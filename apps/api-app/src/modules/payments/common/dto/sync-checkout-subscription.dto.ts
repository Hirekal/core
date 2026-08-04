/**
 * @fileoverview DTO for syncing a subscription after custom checkout payment.
 */
import { IsString, MaxLength } from 'class-validator';

export class SyncCheckoutSubscriptionDto {
  @IsString()
  @MaxLength(255)
  providerSubscriptionId: string;
}
