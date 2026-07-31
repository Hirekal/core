import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';
import { ApplicationFieldType } from '../../enums/job.enums';

export class CreateJobApplicationFieldDto {
    @IsString()
    @MaxLength(255)
    label!: string;

    @IsEnum(ApplicationFieldType)
    type!: ApplicationFieldType;

    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    fieldKey?: string;
}

export class UpdateJobApplicationFieldDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    label?: string;

    @IsOptional()
    @IsEnum(ApplicationFieldType)
    type?: ApplicationFieldType;

    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

export class ReorderApplicationFieldsDto {
    @IsUUID(undefined, { each: true })
    fieldIds!: string[];
}
