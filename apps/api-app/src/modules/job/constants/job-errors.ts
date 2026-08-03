/**
 * User-facing Jobs error messages.
 *
 * - Use with NotFoundException / BadRequestException for expected failures
 * - Use with InternalServerErrorException for unexpected catch failures
 *   (logger keeps technical detail; client gets these safe messages)
 */
export const JobErrors = {
  // Expected client errors
  NOT_FOUND: (id: string) => `Job ${id} not found`,
  NOT_FOUND_BY_SLUG: (slug: string) => `Job with slug ${slug} not found`,
  ONLY_ARCHIVED_CAN_DELETE: 'Only archived jobs can be deleted',
  ONLY_ACTIVE_OR_PAUSED_CAN_ARCHIVE:
    'Only active or paused jobs can be archived',
  INVALID_STATUS_TRANSITION: (from: string, to: string) =>
    `Job must be in ${from} status to transition to ${to}`,
  SLUG_CONFLICT:
    'A job with a similar title was created at the same time. Please try again.',

  // Unexpected failures → InternalServerErrorException
  FAILED_TO_LIST: 'Failed to list jobs',
  FAILED_TO_GET: 'Failed to get job',
  FAILED_TO_CREATE: 'Failed to create job',
  FAILED_TO_UPDATE: 'Failed to update job',
  FAILED_TO_DELETE: 'Failed to delete job',
  FAILED_TO_DUPLICATE: 'Failed to duplicate job',
  FAILED_TO_PREVIEW: 'Failed to preview job',
  FAILED_TO_GET_PUBLIC: 'Failed to get public job',
  FAILED_TO_UPLOAD_INTRO_MEDIA: 'Failed to upload intro media',
  FAILED_TO_DELETE_INTRO_MEDIA: 'Failed to delete intro media',
  FAILED_TO_CHANGE_STATUS: 'Failed to change job status',
} as const;
