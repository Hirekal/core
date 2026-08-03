import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Caps nested arrays so a single request cannot open a huge DB transaction. */
export const MAX_JOB_QUESTIONS = 50;
export const MAX_JOB_APPLICATION_FIELDS = 50;
import {
  ApplicationFieldType,
  EmploymentType,
  IntroMediaType,
  JobStatus,
  QuestionCategory,
  QuestionRetakes,
  QuestionType,
} from '../enums/job.enums';

export class IntroMediaDto {
  @IsOptional()
  @IsEnum(IntroMediaType)
  type?: IntroMediaType;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

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

export class CreateJobDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(255)
  company!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  internalTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  companyWebsite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  candidateIntroTitle?: string;

  @IsOptional()
  @IsString()
  candidateInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  applicationSectionTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  applyButtonLabel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IntroMediaDto)
  introMedia?: IntroMediaDto;

  @IsOptional()
  @IsEnum(QuestionRetakes)
  questionRetakes?: QuestionRetakes;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  transcriptionLanguage?: string;

  @IsOptional()
  @IsBoolean()
  aiTranscripts?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_JOB_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => CreateJobQuestionDto)
  questions?: CreateJobQuestionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_JOB_APPLICATION_FIELDS)
  @ValidateNested({ each: true })
  @Type(() => CreateJobApplicationFieldDto)
  applicationFields?: CreateJobApplicationFieldDto[];
}

export class UpdateJobQuestionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  label?: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

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

export class UpdateJobApplicationFieldDto {
  @IsOptional()
  @IsUUID()
  id?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fieldKey?: string;
}

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  internalTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  companyWebsite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  candidateIntroTitle?: string;

  @IsOptional()
  @IsString()
  candidateInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  applicationSectionTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  applyButtonLabel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IntroMediaDto)
  introMedia?: IntroMediaDto | null;

  @IsOptional()
  @IsEnum(QuestionRetakes)
  questionRetakes?: QuestionRetakes;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  transcriptionLanguage?: string;

  @IsOptional()
  @IsBoolean()
  aiTranscripts?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_JOB_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => UpdateJobQuestionDto)
  questions?: UpdateJobQuestionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_JOB_APPLICATION_FIELDS)
  @ValidateNested({ each: true })
  @Type(() => UpdateJobApplicationFieldDto)
  applicationFields?: UpdateJobApplicationFieldDto[];
}
