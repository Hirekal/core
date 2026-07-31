/**
 * @fileoverview Password and token hashing utilities.
 * Provides bcrypt password hashing and SHA-256 token fingerprinting helpers.
 */
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { LOG_MESSAGES } from '../constants/messages';

const SALT_ROUNDS = 12;
const logger = new Logger('HashUtil');

/**
 * Hashes a plain-text password using bcrypt.
 *
 * @param password - Raw password from the client
 * @returns Bcrypt password hash suitable for persistence
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (error) {
    logger.error(LOG_MESSAGES.HASH.HASH_PASSWORD_FAILED, error);
    throw error;
  }
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 *
 * @param password - Raw password from the client
 * @param hash - Stored bcrypt hash
 * @returns True when the password matches the hash
 */
export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error(LOG_MESSAGES.HASH.COMPARE_PASSWORD_FAILED, error);
    throw error;
  }
}

/**
 * Produces a deterministic SHA-256 fingerprint for opaque tokens and codes.
 *
 * @param token - Raw token or verification code
 * @returns Hex-encoded SHA-256 digest
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a cryptographically secure random hex token.
 *
 * @param bytes - Number of random bytes before hex encoding
 * @returns Random hex string
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generates a numeric one-time code padded to the requested length.
 *
 * @param length - Number of digits in the generated code
 * @returns Zero-padded numeric code string
 */
export function generateCode(length = 6): string {
  const max = 10 ** length;
  return Math.floor(Math.random() * max)
    .toString()
    .padStart(length, '0');
}
