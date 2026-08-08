/**
 * @fileoverview DTO for creating a payment customer.
 */
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePaymentCustomerDto {
  @IsUUID()
  paymentProviderId: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
