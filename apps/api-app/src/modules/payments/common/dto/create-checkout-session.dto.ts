/**
 * @fileoverview DTO for creating a checkout session.
 */
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsUUID()
  priceId: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\/.+/, {
    message: 'returnUrl must be an http(s) URL',
  })
  returnUrl?: string;

  @IsOptional()
  @IsUrl()
  successUrl?: string;

  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}
