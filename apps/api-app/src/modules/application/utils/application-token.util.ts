import { createHash, randomBytes } from 'crypto';

/**
 * Generates a session token and its SHA-256 hash for storage.
 */
export function generateApplicationToken(): {
  token: string;
  hash: string;
} {
  const token = randomBytes(32).toString('hex');
  const hash = hashApplicationToken(token);
  return { token, hash };
}

/**
 * Hashes an application session token for comparison.
 */
export function hashApplicationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
