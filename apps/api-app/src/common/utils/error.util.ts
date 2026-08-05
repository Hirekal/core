import { HttpException, Logger } from '@nestjs/common';

/**
 * Convert an unknown thrown value into a safe log string.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response
    ) {
      const message = (response as { message?: string | string[] }).message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * True for Nest HTTP exceptions (expected 4xx client errors).
 */
export function isHttpException(error: unknown): error is HttpException {
  return error instanceof HttpException;
}

/**
 * Logs expected client errors as a one-line warn; server/unexpected errors keep a stack trace.
 */
export function logServiceError(
  logger: Logger,
  context: string,
  error: unknown,
): void {
  if (isHttpException(error) && error.getStatus() < 500) {
    logger.warn(`${context}: ${toErrorMessage(error)}`);
    return;
  }

  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(`${context}: ${toErrorMessage(error)}`, stack);
}

/**
 * True when Postgres rejected a write for a UNIQUE constraint (SQLSTATE 23505).
 * Duck-typed so duplicate typeorm package instances still match.
 */
export function isPostgresUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
    message?: string;
  };

  if (candidate.driverError?.code === '23505' || candidate.code === '23505') {
    return true;
  }

  return (
    typeof candidate.message === 'string' &&
    candidate.message.toLowerCase().includes('duplicate key')
  );
}

