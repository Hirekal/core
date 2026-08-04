/**
 * @fileoverview DTO for creating a billing portal session.
 */
import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateBillingPortalSessionDto {
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\/.+/, {
    message: 'returnUrl must be an http(s) URL',
  })
  returnUrl: string;

  @IsUUID()
  paymentProviderId: string;
}
