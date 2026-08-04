/**
 * Persist public apply-flow progress in localStorage so refresh can resume.
 * Video blobs and File uploads are not stored (too large / not serializable).
 */

function progressKey(slug) {
  return `hirekal_apply_progress_${slug}`;
}

/**
 * @param {Record<string, unknown>} values
 * @returns {Record<string, string>}
 */
export function serializeApplicationValuesForStorage(values = {}) {
  const out = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof File !== 'undefined' && value instanceof File) {
      continue;
    }
    if (value && typeof value === 'object' && value.url) {
      out[key] = JSON.stringify({
        url: value.url,
        storageKey: value.storageKey || '',
        fileName: value.fileName || '',
        contentType: value.contentType || 'application/pdf',
      });
      continue;
    }
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}

/**
 * @param {string} slug
 * @returns {object|null}
 */
export function readApplyProgress(slug) {
  if (!slug) return null;
  try {
    const raw = localStorage.getItem(progressKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {string} slug
 * @param {object|null} progress
 */
export function writeApplyProgress(slug, progress) {
  if (!slug) return;
  try {
    if (!progress) {
      localStorage.removeItem(progressKey(slug));
      return;
    }
    localStorage.setItem(progressKey(slug), JSON.stringify(progress));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * @param {string} slug
 */
export function clearApplyProgress(slug) {
  writeApplyProgress(slug, null);
}
