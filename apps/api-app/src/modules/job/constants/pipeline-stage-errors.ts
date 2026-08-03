/**
 * User-facing Job Pipeline Stage error messages.
 *
 * - Use with NotFoundException / BadRequestException for expected failures
 * - Use with InternalServerErrorException for unexpected catch failures
 *   (logger keeps technical detail; client gets these safe messages)
 */
export const PipelineStageErrors = {
  // Expected client errors
  NOT_FOUND: (id: string) => `Stage ${id} not found`,
  CANNOT_DELETE_DEFAULT: 'Default stages cannot be deleted',
  STAGE_NOT_IN_JOB: (stageId: string, jobId: string) =>
    `Stage ${stageId} does not belong to job ${jobId}`,

  // Unexpected failures → InternalServerErrorException
  FAILED_TO_LIST: 'Failed to list pipeline stages',
  FAILED_TO_CREATE: 'Failed to create pipeline stage',
  FAILED_TO_UPDATE: 'Failed to update pipeline stage',
  FAILED_TO_DELETE: 'Failed to delete pipeline stage',
  FAILED_TO_REORDER: 'Failed to reorder pipeline stages',
} as const;
