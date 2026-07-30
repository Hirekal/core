/**
 * User-facing Job Settings error messages.
 *
 * - Use with NotFoundException / BadRequestException for expected failures
 * - Use with InternalServerErrorException for unexpected catch failures
 *   (logger keeps technical detail; client gets these safe messages)
 */
export const SettingsErrors = {
    // Expected client errors
    NOT_FOUND: (jobId: string) => `Settings for job ${jobId} not found`,

    // Unexpected failures → InternalServerErrorException
    FAILED_TO_GET: 'Failed to get job settings',
    FAILED_TO_UPDATE: 'Failed to update job settings',
    FAILED_TO_UPLOAD_THANK_YOU_MEDIA: 'Failed to upload thank-you media',
    FAILED_TO_DELETE_THANK_YOU_MEDIA: 'Failed to delete thank-you media',
    FAILED_TO_UPLOAD_SOCIAL_PREVIEW: 'Failed to upload social preview image',
} as const;
