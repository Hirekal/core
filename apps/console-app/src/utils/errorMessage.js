/**
 * Maps raw/network/API errors to short, user-facing copy.
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function toUserErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;

  const status = typeof error === 'object' && error !== null ? error.status : undefined;
  const raw =
    typeof error === 'string'
      ? error
      : typeof error?.message === 'string'
        ? error.message
        : '';

  const normalized = raw.toLowerCase();

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed') ||
    normalized.includes('econnrefused') ||
    normalized.includes('enotfound') ||
    normalized.includes('econnreset') ||
    normalized.includes('etimedout') ||
    normalized.includes('socket hang up') ||
    error?.name === 'TypeError'
  ) {
    return 'Unable to reach the server. Check your connection and try again.';
  }

  if (normalized.includes('aborted') || error?.name === 'AbortError') {
    return 'The request was cancelled. Please try again.';
  }

  if (status === 401) {
    return 'Your session expired. Please sign in again.';
  }
  if (status === 403) {
    return 'You do not have permission to do that.';
  }
  if (status === 404) {
    return 'We could not find what you were looking for.';
  }
  if (status === 409) {
    return raw || 'This action conflicts with the current state. Please refresh and try again.';
  }
  if (status === 422 || status === 400) {
    return raw || 'Please check your input and try again.';
  }
  if (typeof status === 'number' && status >= 500) {
    return 'Something went wrong on our side. Please try again in a moment.';
  }

  // Avoid leaking Nest validation noise / technical wording in the UI.
  if (
    normalized.includes('property ') &&
    normalized.includes('should not exist')
  ) {
    return 'Some settings could not be saved. Please refresh and try again.';
  }

  if (raw && raw.length <= 180 && !normalized.includes('exception')) {
    return raw;
  }

  return fallback;
}
