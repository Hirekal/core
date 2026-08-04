export type ApplicationFieldFileMeta = {
  url: string;
  storageKey: string;
  fileName: string;
  contentType: string;
};

/**
 * Serialize resume / file field metadata for applicationFieldValues.value.
 */
export function serializeFieldFileValue(
  meta: ApplicationFieldFileMeta,
): string {
  return JSON.stringify(meta);
}

/**
 * Parse stored file field value (JSON metadata or legacy plain URL).
 */
export function parseFieldFileValue(
  raw: string | null | undefined,
): ApplicationFieldFileMeta | null {
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
}

/**
 * Whether a stored file field value satisfies a required check.
 */
export function hasFieldFileValue(raw: string | null | undefined): boolean {
  return Boolean(parseFieldFileValue(raw)?.url);
}
