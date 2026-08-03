import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class StageBasedEmailsDto {
  @IsOptional()
  @IsBoolean()
  shortlisted?: boolean;

  @IsOptional()
  @IsBoolean()
  rejected?: boolean;

  @IsOptional()
  @IsBoolean()
  disqualified?: boolean;
}

class WebhookTriggersDto {
  @IsOptional()
  @IsBoolean()
  newApplication?: boolean;

  @IsOptional()
  @IsBoolean()
  stageChange?: boolean;
}

export class PatchGeneralSettingsDto {
  @IsOptional()
  @IsString()
  applicationFormLabel?: string;

  @IsOptional()
  @IsString()
  instructionsLabel?: string;

  @IsOptional()
  @IsBoolean()
  showQuestionsInAdvance?: boolean;

  @IsOptional()
  @IsObject()
  socialPreview?: Record<string, unknown>;
}

export class PatchThankYouPageDto {
  @IsOptional()
  @IsString()
  mediaType?: string | null;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  autoRedirectUrl?: string;
}

export class PatchEmailAutomationDto {
  @IsOptional()
  @IsBoolean()
  inviteApplicants?: boolean;

  @IsOptional()
  @IsBoolean()
  verifyApplicantEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  incompleteReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  confirmationAfterSubmission?: boolean;

  @IsOptional()
  @IsBoolean()
  followUpQuestionEmails?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => StageBasedEmailsDto)
  stageBasedEmails?: StageBasedEmailsDto;
}

export class PatchWebhookSettingsDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WebhookTriggersDto)
  triggers?: WebhookTriggersDto;

  @IsOptional()
  @IsBoolean()
  includeAnswers?: boolean;

  @IsOptional()
  @IsBoolean()
  includeVideoUrls?: boolean;

  @IsOptional()
  @IsBoolean()
  includeAiTranscripts?: boolean;
}
