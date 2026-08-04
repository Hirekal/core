import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const NOTIFICATIONS_DEFAULT_LIMIT = 25;
export const NOTIFICATIONS_MAX_LIMIT = 100;

export class ListNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTIFICATIONS_MAX_LIMIT)
  limit?: number = NOTIFICATIONS_DEFAULT_LIMIT;
}
