/**
 * @fileoverview DTO for attaching a payment method.
 */
import { IsString, IsUUID, MaxLength } from 'class-validator';

export class AttachPaymentMethodDto {
  @IsString()
  @MaxLength(255)
  providerPaymentMethodId: string;

  @IsUUID()
  paymentProviderId: string;
}
