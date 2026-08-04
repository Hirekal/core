import { apiRequest, readSession, writeSession } from './apiClient';

export const CODE_TYPES = {
    EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
    PASSWORD_RESET: 'PASSWORD_RESET',
};

/**
 * Builds a local session object from a sign-in / token response.
 *
 * @param {object} data - API auth response with user + tokens
 * @returns {object} Session stored in localStorage
 */
function toSession(data) {
    return {
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt,
    };
}

/**
 * Signs in with email and password and persists the JWT session.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} Session with user and tokens
 */
export async function login(email, password) {
    const data = await apiRequest('/auth/signin', {
        method: 'POST',
        body: { email, password },
    });

    if (!data?.accessToken || !data?.refreshToken) {
        throw new Error('Sign in failed: server did not return auth tokens');
    }

    const session = toSession(data);
    writeSession(session);
    return session;
}

/**
 * Registers a new account and triggers a verification email.
 * Does not create a logged-in session.
 *
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} Signup response from the API
 */
export async function signUp(name, email, password) {
    return apiRequest('/auth/signup', {
        method: 'POST',
        body: { name, email, password },
    });
}

/**
 * Verifies a one-time email or password-reset code.
 *
 * @param {string} email
 * @param {string} code
 * @param {string} [type]
 * @returns {Promise<object>}
 */
export async function verifyCode(email, code, type) {
    return apiRequest('/auth/verify-code', {
        method: 'POST',
        body: { email, code, ...(type ? { type } : {}) },
    });
}

/**
 * Resends an email verification code.
 *
 * @param {string} email
 * @returns {Promise<object>}
 */
export async function resendVerification(email) {
    return apiRequest('/auth/resend-verification', {
        method: 'POST',
        body: { email },
    });
}

/**
 * Requests a password reset code for the given email.
 *
 * @param {string} email
 * @returns {Promise<object>}
 */
export async function requestPasswordReset(email) {
    return apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email },
    });
}

/**
 * Resets password using the emailed one-time code.
 *
 * @param {string} email
 * @param {string} code
 * @param {string} newPassword
 * @returns {Promise<object>}
 */
export async function resetPassword(email, code, newPassword) {
    return apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { email, code, newPassword },
    });
}

/**
 * Returns the current local session, if any.
 *
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
    return readSession();
}

/**
 * Logs out on the server (best-effort) and clears the local session.
 *
 * @returns {Promise<void>}
 */
export async function logout() {
    const session = readSession();
    try {
        if (session?.accessToken) {
            await apiRequest('/auth/logout', {
                method: 'POST',
                body: { refreshToken: session.refreshToken },
                auth: true,
                retry: false,
            });
        }
    } catch {
        // Clear local session even if the API call fails.
    } finally {
        writeSession(null);
    }
}

/**
 * Loads the authenticated user profile from the API.
 *
 * @returns {Promise<object>} Sanitized user profile
 */
export async function getProfile() {
    return apiRequest('/auth/profile', { auth: true });
}

/**
 * Updates the authenticated user's profile (name/metadata).
 *
 * @param {string} _userId - Unused; kept for call-site compatibility
 * @param {object} data - Profile fields to patch
 * @returns {Promise<object>} Updated user
 */
export async function updateProfile(_userId, data) {
    const payload = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.metadata !== undefined) payload.metadata = data.metadata;

    const user = await apiRequest('/auth/profile', {
        method: 'PATCH',
        body: payload,
        auth: true,
    });

    const session = readSession();
    if (session) {
        writeSession({ ...session, user });
    }
    return user;
}

/**
 * Changes the authenticated user's password.
 * Server revokes all sessions after a successful change.
 *
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<object>}
 */
export async function changePassword(currentPassword, newPassword) {
    return apiRequest('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        auth: true,
    });
}
