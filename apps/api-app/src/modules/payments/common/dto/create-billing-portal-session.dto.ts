/**
 * @fileoverview DTO for creating a billing portal session.
 */
import { IsUrl, IsUUID } from 'class-validator';

export class CreateBillingPortalSessionDto {
  @IsUrl()
  returnUrl: string;

  @IsUUID()
  paymentProviderId: string;
}
