import { Logger } from '@nestjs/common';

export type ApplicationFieldFileMeta = {
  url: string;
  storageKey: string;
  fileName: string;
  contentType: string;
};

const logger = new Logger('ApplicationFieldFileUtil');

/**
 * Serialize resume / file field metadata for applicationFieldValues.value.
 * @param meta - File metadata to persist.
 * @returns JSON string stored in the field value column.
 */
export function serializeFieldFileValue(
  meta: ApplicationFieldFileMeta,
): string {
  try {
    return JSON.stringify(meta);
  } catch (error) {
    logger.error(`serializeFieldFileValue failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Parse stored file field value (JSON metadata or legacy plain URL).
 * @param raw - Stored field value string.
 * @returns Parsed metadata, or null when missing/invalid.
 */
export function parseFieldFileValue(
  raw: string | null | undefined,
): ApplicationFieldFileMeta | null {
  try {
    if (!raw?.trim()) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<ApplicationFieldFileMeta>;
      if (parsed?.url && typeof parsed.url === 'string') {
        return {
          url: parsed.url,
          storageKey:
            typeof parsed.storageKey === 'string' ? parsed.storageKey : '',
          fileName: typeof parsed.fileName === 'string' ? parsed.fileName : '',
          contentType:
            typeof parsed.contentType === 'string'
              ? parsed.contentType
              : 'application/pdf',
        };
      }
    } catch {
      // fall through for legacy plain URL storage
    }

    if (/^https?:\/\//i.test(raw.trim())) {
      return {
        url: raw.trim(),
        storageKey: '',
        fileName: '',
        contentType: 'application/pdf',
      };
    }

    return null;
  } catch (error) {
    logger.error(`parseFieldFileValue failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Whether a stored file field value satisfies a required check.
 * @param raw - Stored field value string.
 * @returns True when a usable file URL is present.
 */
export function hasFieldFileValue(raw: string | null | undefined): boolean {
  try {
    return Boolean(parseFieldFileValue(raw)?.url);
  } catch (error) {
    logger.error(`hasFieldFileValue failed: ${(error as Error).message}`);
    throw error;
  }
}
