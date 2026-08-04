import { BadRequestException, Logger } from '@nestjs/common';
import { CloudStorageErrors } from '../../cloud-storage/constants/cloud-storage-errors';
import { ApplicationErrors } from '../constants/application-errors';
import {
  MAX_RESUME_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  PDF_MIME_TYPES,
  VIDEO_MIME_TYPES,
} from '../../job/constants/job-defaults';

const logger = new Logger('ApplicationMediaUtil');

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
  try {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'webm';
    const uuid = crypto.randomUUID();
    return `orgs/${organizationId}/jobs/${jobId}/applications/${applicationId}/answers/${questionId}/${uuid}.${ext}`;
  } catch (error) {
    logger.error(
      `buildApplicationAnswerMediaKey failed: ${(error as Error).message}`,
    );
    throw error;
  }
}

/**
 * Build R2 storage key for an application field file (e.g. resume PDF).
 * @param organizationId - The ID of the organization.
 * @param jobId - The ID of the job.
 * @param applicationId - The ID of the application.
 * @param fieldId - The ID of the application field.
 * @param fileName - The name of the file.
 * @returns The R2 storage key for the field file.
 */
export function buildApplicationFieldFileKey(
  organizationId: string,
  jobId: string,
  applicationId: string,
  fieldId: string,
  fileName: string,
): string {
  try {
    const ext = fileName.includes('.') ? fileName.split('.').pop() : 'pdf';
    const uuid = crypto.randomUUID();
    return `orgs/${organizationId}/jobs/${jobId}/applications/${applicationId}/fields/${fieldId}/${uuid}.${ext}`;
  } catch (error) {
    logger.error(
      `buildApplicationFieldFileKey failed: ${(error as Error).message}`,
    );
    throw error;
  }
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
  try {
    const expectedPrefix = `orgs/${organizationId}/jobs/${jobId}/applications/${applicationId}/answers/${questionId}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new BadRequestException(CloudStorageErrors.INVALID_STORAGE_KEY);
    }
  } catch (error) {
    logger.error(
      `assertApplicationAnswerMediaKeyScope failed: ${(error as Error).message}`,
    );
    throw error;
  }
}

/**
 * Ensures a storage key belongs to the expected application field file prefix.
 * @param storageKey - The storage key to validate.
 * @param organizationId - The ID of the organization.
 * @param jobId - The ID of the job.
 * @param applicationId - The ID of the application.
 * @param fieldId - The ID of the application field.
 * @returns The void.
 */
export function assertApplicationFieldFileKeyScope(
  storageKey: string,
  organizationId: string,
  jobId: string,
  applicationId: string,
  fieldId: string,
): void {
  try {
    const expectedPrefix = `orgs/${organizationId}/jobs/${jobId}/applications/${applicationId}/fields/${fieldId}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new BadRequestException(CloudStorageErrors.INVALID_STORAGE_KEY);
    }
  } catch (error) {
    logger.error(
      `assertApplicationFieldFileKeyScope failed: ${(error as Error).message}`,
    );
    throw error;
  }
}

/**
 * Validate candidate video upload metadata.
 * @param mimetype - The MIME type of the file.
 * @param size - The size of the file.
 * @returns The void.
 */
export function validateAnswerVideoFile(mimetype: string, size: number): void {
  try {
    if (!VIDEO_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        ApplicationErrors.UNSUPPORTED_MEDIA_TYPE(mimetype),
      );
    }
    if (size > MAX_VIDEO_SIZE_BYTES) {
      throw new BadRequestException(ApplicationErrors.VIDEO_TOO_LARGE);
    }
  } catch (error) {
    logger.error(`validateAnswerVideoFile failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Validate resume / application field PDF upload metadata.
 * @param mimetype - The MIME type of the file.
 * @param size - The size of the file.
 * @returns The void.
 */
export function validateApplicationFieldPdf(
  mimetype: string,
  size: number,
): void {
  try {
    if (!PDF_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(ApplicationErrors.PDF_ONLY_FIELD);
    }
    if (size > MAX_RESUME_SIZE_BYTES) {
      throw new BadRequestException(ApplicationErrors.FIELD_FILE_TOO_LARGE);
    }
  } catch (error) {
    logger.error(
      `validateApplicationFieldPdf failed: ${(error as Error).message}`,
    );
    throw error;
  }
}
