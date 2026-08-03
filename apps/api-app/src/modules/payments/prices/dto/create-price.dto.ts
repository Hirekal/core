/**
 * @fileoverview DTO for creating a price.
 */
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PriceInterval } from '../../common/enums/payment.enums';

export class CreatePriceDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  paymentProviderId: string;

  @IsString()
  @MaxLength(10)
  currency: string;

  @IsInt()
  @Min(1)
  /** Major currency unit (e.g. 999 USD = $999.00). Converted internally for providers. */
  amount: number;

  @IsOptional()
  @IsEnum(PriceInterval)
  interval?: PriceInterval;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalCount?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
