import { Type } from 'class-transformer';
import {
    IsArray,
    IsNumber,
    IsString,
    Min,
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

export class MediaWorkerCallbackDto {
    @IsString()
    job_id!: string;

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

export interface MediaWorkerTranscribeResponse {
    job_id: string;
    language: string;
    duration: number;
    text: string;
    segments: MediaWorkerTranscriptSegmentDto[];
}
