import { Type } from 'class-transformer';
import {
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';

class StartApplicationFieldsDto {
    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsObject()
    custom?: Record<string, string>;
}

export class StartApplicationDto {
    @IsOptional()
    @IsString()
    sessionId?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => StartApplicationFieldsDto)
    fields?: StartApplicationFieldsDto;
}

export class UpdateApplicationDto {
    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsObject()
    custom?: Record<string, string>;
}

export class UpsertAnswerDto {
    @IsOptional()
    @IsString()
    answerText?: string;
}

export class ListApplicationsQueryDto {
    @IsOptional()
    @IsUUID()
    stageId?: string;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    sortBy?: string;
}

export class UpdateApplicationStageDto {
    @IsUUID()
    @IsNotEmpty()
    stageId!: string;
}

export class UpdateApplicationRatingDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    rating!: number | null;
}

export class AddApplicationNoteDto {
    @IsString()
    @IsNotEmpty()
    text!: string;
}
