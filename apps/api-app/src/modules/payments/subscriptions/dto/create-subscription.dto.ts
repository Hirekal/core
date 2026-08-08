/**
 * @fileoverview DTO for creating a subscription.
 */
import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  priceId: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
