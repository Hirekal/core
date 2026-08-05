import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MediaWorkerPayloadStatus } from '../../enums/application.enums';

export class MediaWorkerTranscriptSegmentDto {
  @IsNumber()
  @Min(0)
  start!: number;

  @IsNumber()
  @Min(0)
  end!: number;

  @IsString()
  text!: string;
}

/** Nested transcript block from the current media-worker callback shape. */
export class MediaWorkerTranscriptResultDto {
  @IsString()
  language!: string;

  @IsNumber()
  @Min(0)
  duration!: number;

  @IsString()
  text!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaWorkerTranscriptSegmentDto)
  segments!: MediaWorkerTranscriptSegmentDto[];
}

/** SpeechBrain metrics (all optional; omitted fields are dropped by the worker). */
export class MediaWorkerSpeechMetricsDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsNumber()
  language_confidence?: number;

  @IsOptional()
  @IsNumber()
  speech_duration?: number;

  @IsOptional()
  @IsNumber()
  silence_duration?: number;

  @IsOptional()
  @IsNumber()
  speech_ratio?: number;

  @IsOptional()
  @IsNumber()
  average_pause_duration?: number;

  @IsOptional()
  @IsNumber()
  longest_pause_duration?: number;

  @IsOptional()
  @IsNumber()
  speaking_rate?: number;
}

/** Pronunciation assessment block from the media worker. */
export class MediaWorkerAssessmentDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  pronunciation_accuracy!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  prosody_score!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  fluency_score!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  completeness_score?: number | null;

  @IsString()
  reference_text!: string;

  @IsString()
  asr_transcript!: string;

  /** Kept loosely typed so nested phoneme/word detail is not stripped. */
  @IsOptional()
  @IsArray()
  phonemes?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  words?: Record<string, unknown>[];
}

/**
 * Path B callback payload from the media worker.
 * Success (nested): job_id + transcript (+ optional speech/assessment)
 * Success (legacy flat): job_id + language/duration/text/segments
 * Failure: job_id + status=failed + error
 */
export class MediaWorkerCallbackDto {
  @IsString()
  job_id!: string;

  @IsOptional()
  @IsEnum(MediaWorkerPayloadStatus)
  status?: MediaWorkerPayloadStatus;

  @ValidateIf(
    (o: MediaWorkerCallbackDto) => o.status === MediaWorkerPayloadStatus.FAILED,
  )
  @IsString()
  error?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaWorkerTranscriptResultDto)
  transcript?: MediaWorkerTranscriptResultDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaWorkerSpeechMetricsDto)
  speech?: MediaWorkerSpeechMetricsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaWorkerAssessmentDto)
  assessment?: MediaWorkerAssessmentDto;

  /** Legacy flat success fields (pre-nested callback). */
  @ValidateIf(
    (o: MediaWorkerCallbackDto) =>
      o.status !== MediaWorkerPayloadStatus.FAILED && o.transcript == null,
  )
  @IsString()
  language?: string;

  @ValidateIf(
    (o: MediaWorkerCallbackDto) =>
      o.status !== MediaWorkerPayloadStatus.FAILED && o.transcript == null,
  )
  @IsNumber()
  @Min(0)
  duration?: number;

  @ValidateIf(
    (o: MediaWorkerCallbackDto) =>
      o.status !== MediaWorkerPayloadStatus.FAILED && o.transcript == null,
  )
  @IsString()
  text?: string;

  @ValidateIf(
    (o: MediaWorkerCallbackDto) =>
      o.status !== MediaWorkerPayloadStatus.FAILED && o.transcript == null,
  )
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaWorkerTranscriptSegmentDto)
  segments?: MediaWorkerTranscriptSegmentDto[];
}

/** Immediate ack from POST /transcribe (Path B-only; no transcript body). */
export interface MediaWorkerAcceptResponse {
  job_id: string;
  status: MediaWorkerPayloadStatus.ACCEPTED;
}
