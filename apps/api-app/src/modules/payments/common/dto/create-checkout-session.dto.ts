/**
 * @fileoverview DTO for creating a checkout session.
 */
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
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
}
