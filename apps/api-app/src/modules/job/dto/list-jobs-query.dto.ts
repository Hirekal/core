import { Type } from 'class-transformer';
import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import {
    JobListStatusFilter,
    JobSortBy,
    SortOrder,
} from '../enums/job.enums';

export class ListJobsQueryDto {
    @IsOptional()
    @IsEnum(JobListStatusFilter)
    status?: JobListStatusFilter;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(JobSortBy)
    sortBy?: JobSortBy;

    @IsOptional()
    @IsEnum(SortOrder)
    order?: SortOrder;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}
