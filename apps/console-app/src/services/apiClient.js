const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

const AUTH_KEY = 'hirekal_auth';
const LEGACY_AUTH_KEY = 'talently_auth';

/** Dispatched when stored tokens are invalid and the local session was cleared. */
export const AUTH_EXPIRED_EVENT = 'hirekal:auth-expired';

/**
 * Reads the persisted auth session from localStorage.
 *
 * @returns {object|null} Session payload or null when missing/invalid
 */
export function readSession() {
  let stored = localStorage.getItem(AUTH_KEY);
  if (!stored) {
    const legacy = localStorage.getItem(LEGACY_AUTH_KEY);
    if (legacy) {
      localStorage.setItem(AUTH_KEY, legacy);
      localStorage.removeItem(LEGACY_AUTH_KEY);
      stored = legacy;
    }
  }
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Persists the auth session to localStorage.
 *
 * @param {object|null} session - Session to store, or null to clear
 */
export function writeSession(session) {
  if (!session) {
    localStorage.removeItem(AUTH_KEY);
    return;
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

/**
 * Clears the local session and notifies the app that auth expired.
 */
export function clearExpiredSession() {
  writeSession(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

/**
 * Extracts a readable message from a NestJS error response body.
 *
 * @param {unknown} body - Parsed JSON error body
 * @param {number} status - HTTP status code
 * @returns {string} Human-readable error message
 */
function extractErrorMessage(body, status) {
  if (!body || typeof body !== 'object') {
    return `Request failed (${status})`;
  }
  const message = body.message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }
  return `Request failed (${status})`;
}

/**
 * Unwraps `{ success, message, data }` envelopes when present.
 *
 * @param {unknown} payload - Raw API JSON
 * @returns {unknown} Inner data or the original payload
 */
export function unwrapApiData(payload) {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
    return payload.data;
  }
  return payload;
}

/**
 * Applies refreshed tokens from response headers into the local session.
 *
 * @param {Response} response - Fetch response
 * @param {boolean} auth - Whether the request used auth headers
 */
function persistTokensFromHeaders(response, auth) {
  if (!auth) return;
  const refreshedAccess = response.headers.get('Authorization');
  const refreshedRefresh = response.headers.get('X-Refresh-Token');
  if (!refreshedAccess && !refreshedRefresh) return;

  const session = readSession() || {};
  if (refreshedAccess?.startsWith('Bearer ')) {
    session.accessToken = refreshedAccess.slice(7);
  }
  if (refreshedRefresh) {
    session.refreshToken = refreshedRefresh;
  }
  const accessExpires = response.headers.get('X-Access-Token-ExpiresAt');
  const refreshExpires = response.headers.get('X-Refresh-Token-Expires-At');
  if (accessExpires) session.accessTokenExpiresAt = accessExpires;
  if (refreshExpires) session.refreshTokenExpiresAt = refreshExpires;
  writeSession(session);
}

/**
 * Low-level fetch against the Hirekal API.
 *
 * @param {string} path - Path under the API base URL (e.g. `/auth/signin`)
 * @param {object} [options]
 * @param {string} [options.method='GET'] - HTTP method
 * @param {object|FormData} [options.body] - JSON body or FormData
 * @param {boolean} [options.auth=false] - Attach Bearer access token
 * @param {boolean} [options.retry=true] - Retry once after refresh on 401
 * @returns {Promise<any>} Unwrapped response data
 */
export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = false,
    retry = true,
  } = options;

  const headers = {
    Accept: 'application/json',
  };

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const session = readSession();
    if (session?.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
    if (session?.refreshToken) {
      headers['X-Refresh-Token'] = session.refreshToken;
    }
  }

  let requestBody;
  if (body !== undefined) {
    requestBody = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
  });

  persistTokensFromHeaders(response, auth);

  if (response.status === 401 && auth && retry) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return apiRequest(path, { ...options, retry: false });
    }
    clearExpiredSession();
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearExpiredSession();
    }
    const error = new Error(extractErrorMessage(data, response.status));
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return unwrapApiData(data);
}

/**
 * Uploads a multipart file to an authenticated endpoint.
 *
 * @param {string} path - API path
 * @param {Blob|File} file - File payload
 * @param {string} [fieldName='file'] - Form field name
 * @returns {Promise<any>} Unwrapped response data
 */
export async function apiUpload(path, file, fieldName = 'file') {
  const formData = new FormData();
  formData.append(fieldName, file, file.name || 'upload');
  return apiRequest(path, {
    method: 'POST',
    body: formData,
    auth: true,
  });
}

/**
 * Attempts to refresh tokens using the stored refresh token.
 *
 * @returns {Promise<boolean>} True when a new session was stored
 */
async function tryRefreshSession() {
  const session = readSession();
  if (!session?.refreshToken) {
    return false;
  }

  try {
    const data = await apiRequest('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: session.refreshToken },
      auth: false,
      retry: false,
    });

    writeSession({
      ...session,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExpiresAt: data.accessTokenExpiresAt,
      refreshTokenExpiresAt: data.refreshTokenExpiresAt,
    });
    return true;
  } catch {
    writeSession(null);
    return false;
  }
}
