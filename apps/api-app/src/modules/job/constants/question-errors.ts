/**
 * User-facing Job Question error messages.
 *
 * - Use with NotFoundException / BadRequestException for expected failures
 * - Use with InternalServerErrorException for unexpected catch failures
 *   (logger keeps technical detail; client gets these safe messages)
 */
export const QuestionErrors = {
  // Expected client errors
  NOT_FOUND: (id: string) => `Question ${id} not found`,
  BUILTIN_VIDEO_EXISTS: 'Built-in video question already exists for this job',
  CANNOT_CHANGE_BUILTIN_TYPE: 'Cannot change type of built-in video question',
  CANNOT_DELETE_BUILTIN: 'Built-in questions cannot be deleted',
  QUESTION_NOT_IN_JOB: (questionId: string, jobId: string) =>
    `Question ${questionId} does not belong to job ${jobId}`,

  // Unexpected failures → InternalServerErrorException
  FAILED_TO_LIST: 'Failed to list questions',
  FAILED_TO_CREATE: 'Failed to create question',
  FAILED_TO_UPDATE: 'Failed to update question',
  FAILED_TO_DELETE: 'Failed to delete question',
  FAILED_TO_REORDER: 'Failed to reorder questions',
} as const;
