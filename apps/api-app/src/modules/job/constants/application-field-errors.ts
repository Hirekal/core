/**
 * User-facing Job Application Field error messages.
 *
 * - Use with NotFoundException / BadRequestException for expected failures
 * - Use with InternalServerErrorException for unexpected catch failures
 *   (logger keeps technical detail; client gets these safe messages)
 */
export const ApplicationFieldErrors = {
    // Expected client errors
    NOT_FOUND: (id: string) => `Field ${id} not found`,
    CANNOT_CHANGE_BUILTIN_TYPE: 'Cannot change type of built-in field',
    CANNOT_DELETE_BUILTIN: 'Built-in fields cannot be deleted',
    FIELD_NOT_IN_JOB: (fieldId: string, jobId: string) =>
        `Field ${fieldId} does not belong to job ${jobId}`,

    // Unexpected failures → InternalServerErrorException
    FAILED_TO_LIST: 'Failed to list application fields',
    FAILED_TO_CREATE: 'Failed to create application field',
    FAILED_TO_UPDATE: 'Failed to update application field',
    FAILED_TO_DELETE: 'Failed to delete application field',
    FAILED_TO_REORDER: 'Failed to reorder application fields',
} as const;
