import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';
import {
    QuestionCategory,
    QuestionType,
} from '../../enums/job.enums';

export class CreateJobQuestionDto {
    @IsString()
    @MaxLength(500)
    label!: string;

    @IsEnum(QuestionType)
    type!: QuestionType;

    @IsOptional()
    @IsEnum(QuestionCategory)
    category?: QuestionCategory;

    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @IsOptional()
    @IsObject()
    options?: Record<string, unknown>;
}

export class UpdateJobQuestionDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    label?: string;

    @IsOptional()
    @IsEnum(QuestionType)
    type?: QuestionType;

    @IsOptional()
    @IsBoolean()
    required?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @IsOptional()
    @IsObject()
    options?: Record<string, unknown>;
}

export class ReorderQuestionsDto {
    @IsUUID(undefined, { each: true })
    questionIds!: string[];
}
