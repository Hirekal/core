import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

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

/**
 * Path B callback payload from the media worker.
 * Success: job_id + language/duration/text/segments (optional status=completed)
 * Failure: job_id + status=failed + error
 */
export class MediaWorkerCallbackDto {
  @IsString()
  job_id!: string;

  @IsOptional()
  @IsIn(['completed', 'failed', 'accepted'])
  status?: string;

  @ValidateIf((o: MediaWorkerCallbackDto) => o.status === 'failed')
  @IsString()
  error?: string;

  @ValidateIf((o: MediaWorkerCallbackDto) => o.status !== 'failed')
  @IsString()
  language?: string;

  @ValidateIf((o: MediaWorkerCallbackDto) => o.status !== 'failed')
  @IsNumber()
  @Min(0)
  duration?: number;

  @ValidateIf((o: MediaWorkerCallbackDto) => o.status !== 'failed')
  @IsString()
  text?: string;

  @ValidateIf((o: MediaWorkerCallbackDto) => o.status !== 'failed')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaWorkerTranscriptSegmentDto)
  segments?: MediaWorkerTranscriptSegmentDto[];
}

/** Immediate ack from POST /transcribe (Path B-only; no transcript body). */
export interface MediaWorkerAcceptResponse {
  job_id: string;
  status: 'accepted';
}
