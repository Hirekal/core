import { QueryFailedError } from 'typeorm';

/**
 * Convert an unknown thrown value into a safe log string.
 */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * True when Postgres rejected a write for a UNIQUE constraint (SQLSTATE 23505).
 * Used to retry slug allocation after a TOCTOU race.
 */
export function isPostgresUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string } | undefined;
  return driverError?.code === '23505';
}
