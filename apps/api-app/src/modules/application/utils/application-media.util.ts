import { BadRequestException } from '@nestjs/common';
import { CloudStorageErrors } from '../../cloud-storage/constants/cloud-storage-errors';
import {
    MAX_VIDEO_SIZE_BYTES,
    VIDEO_MIME_TYPES,
} from '../../job/constants/job-defaults';

/**
 * Build R2 storage key for a candidate video answer.
 * @param organizationId - The ID of the organization.
 * @param jobId - The ID of the job.
 * @param applicationId - The ID of the application.
 * @param questionId - The ID of the question.
 * @param fileName - The name of the file.
 * @returns The R2 storage key for the candidate video answer.
 */
export function buildApplicationAnswerMediaKey(
    organizationId: string,
    jobId: string,
    applicationId: string,
    questionId: string,
    fileName: string,
): string {
    const ext = fileName.includes('.')
        ? fileName.split('.').pop()
        : 'webm';
    const uuid = crypto.randomUUID();
    return `orgs/${organizationId}/jobs/${jobId}/applications/${applicationId}/answers/${questionId}/${uuid}.${ext}`;
}

/**
 * Ensures a storage key belongs to the expected application answer prefix.
 * @param storageKey - The storage key to validate.
 * @param organizationId - The ID of the organization.
 * @param jobId - The ID of the job.
 * @param applicationId - The ID of the application.
 * @param questionId - The ID of the question.
 * @returns The void.
 */
export function assertApplicationAnswerMediaKeyScope(
    storageKey: string,
    organizationId: string,
    jobId: string,
    applicationId: string,
    questionId: string,
): void {
    const expectedPrefix = `orgs/${organizationId}/jobs/${jobId}/applications/${applicationId}/answers/${questionId}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
        throw new BadRequestException(CloudStorageErrors.INVALID_STORAGE_KEY);
    }
}

/**
 * Validate candidate video upload metadata.
 * @param mimetype - The MIME type of the file.
 * @param size - The size of the file.
 * @returns The void.
 */
export function validateAnswerVideoFile(
    mimetype: string,
    size: number,
): void {
    if (!VIDEO_MIME_TYPES.includes(mimetype)) {
        throw new BadRequestException(`Unsupported media type: ${mimetype}`);
    }
    if (size > MAX_VIDEO_SIZE_BYTES) {
        throw new BadRequestException('Video exceeds maximum size of 100MB');
    }
}
