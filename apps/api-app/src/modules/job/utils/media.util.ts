import { BadRequestException } from '@nestjs/common';
import {
    IMAGE_MIME_TYPES,
    MAX_IMAGE_SIZE_BYTES,
    MAX_VIDEO_SIZE_BYTES,
    VIDEO_MIME_TYPES,
} from '../constants/job-defaults';
import { IntroMediaType } from '../enums/job.enums';

/**
 * Validate uploaded media file type and size.
 * @param mimetype 
 * @param size 
 * @param allowVideo 
 * @returns 
 */
export function validateMediaFile(
    mimetype: string,
    size: number,
    allowVideo = true,
): IntroMediaType {
    if (IMAGE_MIME_TYPES.includes(mimetype)) {
        if (size > MAX_IMAGE_SIZE_BYTES) {
            throw new BadRequestException('Image exceeds maximum size of 10MB');
        }
        return IntroMediaType.IMAGE;
    }

    if (allowVideo && VIDEO_MIME_TYPES.includes(mimetype)) {
        if (size > MAX_VIDEO_SIZE_BYTES) {
            throw new BadRequestException('Video exceeds maximum size of 100MB');
        }
        return IntroMediaType.VIDEO;
    }

    throw new BadRequestException(`Unsupported media type: ${mimetype}`);
}

/**
 * Build R2 storage key for job media assets.
 * @param organizationId 
 * @param jobId 
 * @param folder 
 * @param fileName 
 * @returns 
 */
export function buildMediaKey(
    organizationId: string,
    jobId: string,
    folder: 'intro' | 'thank-you' | 'social-preview',
    fileName: string,
): string {
    const ext = fileName.includes('.')
        ? fileName.split('.').pop()
        : 'bin';
    const uuid = crypto.randomUUID();
    return `orgs/${organizationId}/jobs/${jobId}/${folder}/${uuid}.${ext}`;
}
