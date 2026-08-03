export const ERROR_MESSAGES = {
  AUTH: {
    EMAIL_ALREADY_REGISTERED: 'Email already registered',
    INVALID_CREDENTIALS: 'Invalid credentials',
    ACCOUNT_INACTIVE: 'Account is inactive',
    EMAIL_NOT_VERIFIED:
      'Email is not verified. Please verify your email before signing in',
    INVALID_REFRESH_TOKEN: 'Invalid refresh token',
    NO_PROFILE_FIELDS: 'No profile fields provided to update',
    INVALID_VERIFICATION_REQUEST: 'Invalid verification request',
    INVALID_RESET_REQUEST: 'Invalid reset request',
    INVALID_OR_MISSING_TOKEN: 'Invalid or missing token',
    SESSION_INVALID_OR_EXPIRED: 'Session is invalid or expired',
    EMAIL_ALREADY_VERIFIED: 'Email is already verified',
    CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
  },
  USER: {
    NOT_FOUND: 'User not found',
    EMAIL_ALREADY_REGISTERED: 'Email already registered',
  },
  ROLE: {
    NOT_FOUND: 'Role not found',
    ALREADY_EXISTS: 'Role already exists',
  },
  ORGANIZATION: {
    NOT_FOUND: 'Organization not found',
  },
  USER_CODE: {
    INVALID: 'Invalid verification code',
    EXPIRED: 'Verification code expired',
    MAX_ATTEMPTS: 'Maximum verification attempts exceeded',
  },
  SESSION: {
    NOT_FOUND: 'Session not found',
  },
  USER_ROLE: {
    NOT_FOUND: 'User role not found',
  },
  EMAIL_LOG: {
    NOT_FOUND: 'Email log not found',
  },
  VALIDATION: {
    AT_LEAST_ONE_FIELD: (fields: string) =>
      `At least one of the following fields must be provided: ${fields}`,
  },
} as const;

export const SUCCESS_MESSAGES = {
  AUTH: {
    LOGGED_OUT: 'Logged out successfully',
    RESET_CODE_SENT: 'If the email exists, a reset code has been sent',
    VERIFICATION_CODE_SENT:
      'If the email exists and is unverified, a verification code has been sent',
    CODE_VERIFIED: 'Code verified successfully',
    PASSWORD_RESET: 'Password reset successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
  },
} as const;

export const EMAIL_SUBJECTS = {
  VERIFY_EMAIL: 'Verify your email',
  PASSWORD_RESET: 'Password reset code',
} as const;

export const ROLE_DESCRIPTIONS = {
  ADMIN: 'System administrator',
  RECRUITER: 'Recruiter role',
} as const;

export const LOG_MESSAGES = {
  CONTROLLER: {
    AUTH_SIGNUP_FAILED: 'POST /auth/signup failed',
    AUTH_SIGNIN_FAILED: 'POST /auth/signin failed',
    AUTH_LOGOUT_FAILED: 'POST /auth/logout failed',
    AUTH_REFRESH_FAILED: 'POST /auth/refresh failed',
    AUTH_PROFILE_GET_FAILED: 'GET /auth/profile failed',
    AUTH_PROFILE_PATCH_FAILED: 'PATCH /auth/profile failed',
    AUTH_FORGOT_PASSWORD_FAILED: 'POST /auth/forgot-password failed',
    AUTH_RESEND_VERIFICATION_FAILED: 'POST /auth/resend-verification failed',
    AUTH_VERIFY_CODE_FAILED: 'POST /auth/verify-code failed',
    AUTH_RESET_PASSWORD_FAILED: 'POST /auth/reset-password failed',
    AUTH_CHANGE_PASSWORD_FAILED: 'POST /auth/change-password failed',
    USERS_CREATE_FAILED: 'POST /users failed',
    USERS_LIST_FAILED: 'GET /users failed',
    USERS_GET_FAILED: (id: string) => `GET /users/${id} failed`,
    USERS_PATCH_FAILED: (id: string) => `PATCH /users/${id} failed`,
    USERS_DELETE_FAILED: (id: string) => `DELETE /users/${id} failed`,
    ROLES_CREATE_FAILED: 'POST /roles failed',
    ROLES_LIST_FAILED: 'GET /roles failed',
    ROLES_GET_FAILED: (id: string) => `GET /roles/${id} failed`,
    ROLES_PATCH_FAILED: (id: string) => `PATCH /roles/${id} failed`,
    ROLES_DELETE_FAILED: (id: string) => `DELETE /roles/${id} failed`,
    ORGANIZATIONS_CREATE_FAILED: 'POST /organizations failed',
    ORGANIZATIONS_LIST_FAILED: 'GET /organizations failed',
    ORGANIZATIONS_GET_FAILED: (id: string) => `GET /organizations/${id} failed`,
    ORGANIZATIONS_PATCH_FAILED: (id: string) =>
      `PATCH /organizations/${id} failed`,
    ORGANIZATIONS_DELETE_FAILED: (id: string) =>
      `DELETE /organizations/${id} failed`,
  },
  AUTH: {
    SIGNUP_FAILED: (email: string) => `Signup failed for email: ${email}`,
    SIGNIN_FAILED: (email: string) => `Signin failed for email: ${email}`,
    LOGOUT_FAILED: (userId: string) => `Logout failed for user: ${userId}`,
    REFRESH_FLOW_FAILED: 'Refresh token flow failed',
    GET_PROFILE_FAILED: (userId: string) =>
      `Failed to get profile for user: ${userId}`,
    UPDATE_PROFILE_FAILED: (userId: string) =>
      `Failed to update profile for user: ${userId}`,
    FORGOT_PASSWORD_FAILED: (email: string) =>
      `Forgot password failed for email: ${email}`,
    RESEND_VERIFICATION_FAILED: (email: string) =>
      `Resend verification failed for email: ${email}`,
    VERIFY_CODE_FAILED: (email: string) =>
      `Verify code failed for email: ${email}`,
    RESET_PASSWORD_FAILED: (email: string) =>
      `Reset password failed for email: ${email}`,
    CHANGE_PASSWORD_FAILED: (userId: string) =>
      `Change password failed for user: ${userId}`,
    ISSUE_TOKENS_FAILED: (userId: string) =>
      `Failed to issue tokens for user: ${userId}`,
    ACCESS_TOKEN_ISSUED: (userId: string, expiresAt: string) =>
      `Access token issued for user ${userId}, expires at ${expiresAt}`,
    REFRESH_TOKEN_ISSUED: (userId: string, expiresAt: string) =>
      `Refresh token issued for user ${userId}, expires at ${expiresAt}`,
    REFRESH_REVOKED_ON_LOGOUT: (userId: string, sessionId: string) =>
      `Refresh token revoked on logout for user ${userId}, session ${sessionId}`,
    LOGOUT_TOKEN_MISMATCH: (userId: string) =>
      `Logout refresh token not found or mismatched for user ${userId}`,
    REVOKING_ALL_SESSIONS: (userId: string) =>
      `Revoking all sessions on logout for user ${userId}`,
    REFRESH_REJECTED: 'Refresh token rejected: session not found',
    REFRESH_EXPIRED: (userId: string, sessionId: string) =>
      `Refresh token expired for user ${userId}, session ${sessionId}`,
    REFRESH_ACCEPTED: (userId: string, sessionId: string) =>
      `Refresh token accepted for user ${userId}, session ${sessionId}`,
    OLD_SESSION_REVOKED: (userId: string, sessionId: string) =>
      `Old refresh session revoked for user ${userId}, session ${sessionId}`,
    PROFILE_PATCH_REQUEST: (userId: string, body: string) =>
      `PATCH /auth/profile userId=${userId} body=${body}`,
  },
  USER: {
    CREATE_FAILED: (email: string) => `Failed to create user: ${email}`,
    LIST_FAILED: 'Failed to list users',
    FIND_FAILED: (id: string) => `Failed to find user: ${id}`,
    FIND_BY_EMAIL_FAILED: (email: string) =>
      `Failed to find user by email: ${email}`,
    UPDATE_FAILED: (id: string) => `Failed to update user: ${id}`,
    REMOVE_FAILED: (id: string) => `Failed to remove user: ${id}`,
    UPDATE_LAST_LOGIN_FAILED: (id: string) =>
      `Failed to update last login for user: ${id}`,
  },
  ROLE: {
    CREATE_FAILED: (name: string) => `Failed to create role: ${name}`,
    LIST_FAILED: 'Failed to list roles',
    FIND_FAILED: (id: string) => `Failed to find role: ${id}`,
    FIND_BY_NAME_FAILED: (name: string) =>
      `Failed to find role by name: ${name}`,
    UPDATE_FAILED: (id: string) => `Failed to update role: ${id}`,
    REMOVE_FAILED: (id: string) => `Failed to remove role: ${id}`,
  },
  ORGANIZATION: {
    CREATE_FAILED: (name: string) => `Failed to create organization: ${name}`,
    LIST_FAILED: 'Failed to list organizations',
    FIND_FAILED: (id: string) => `Failed to find organization: ${id}`,
    UPDATE_FAILED: (id: string) => `Failed to update organization: ${id}`,
    REMOVE_FAILED: (id: string) => `Failed to remove organization: ${id}`,
  },
  USER_CODE: {
    CREATE_FAILED: (userId: string) =>
      `Failed to create user code for user: ${userId}`,
    VERIFY_FAILED: (userId: string) =>
      `Failed to verify code for user: ${userId}`,
    MARK_VERIFIED_FAILED: (id: string) =>
      `Failed to mark user code verified: ${id}`,
  },
  SESSION: {
    CREATE_FAILED: (userId: string) =>
      `Failed to create session for user: ${userId}`,
    FIND_BY_REFRESH_FAILED: 'Failed to find session by refresh token hash',
    FIND_BY_ACCESS_FAILED: 'Failed to find session by access token hash',
    REVOKE_FAILED: (id: string) => `Failed to revoke session: ${id}`,
    REVOKE_BY_USER_FAILED: (userId: string) =>
      `Failed to revoke sessions for user: ${userId}`,
    TOUCH_FAILED: (id: string) => `Failed to touch session: ${id}`,
  },
  USER_ROLE: {
    ASSIGN_FAILED: (roleId: string, userId: string) =>
      `Failed to assign role ${roleId} to user ${userId}`,
    FIND_BY_USER_FAILED: (userId: string) =>
      `Failed to find roles for user: ${userId}`,
    REMOVE_FAILED: (id: string) => `Failed to remove user role: ${id}`,
  },
  EMAIL: {
    LOG_FAILED: (email: string) => `Failed to log email: ${email}`,
    MARK_SENT_FAILED: (id: string) => `Failed to mark email log sent: ${id}`,
    SEND_FAILED: (email: string) => `Failed to send email to: ${email}`,
    BREVO_NOT_CONFIGURED:
      'Brevo is not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL); emails will be skipped',
    BREVO_SEND_SKIPPED: (email: string, subject: string) =>
      `Brevo send skipped for ${email} subject="${subject}"`,
    BREVO_SEND_FAILED: (email: string, subject: string) =>
      `Brevo send failed for ${email} subject="${subject}"`,
    CODE_LOGGED_LOCALLY: (email: string, code: string) =>
      `Email code for ${email} (Brevo skipped): ${code}`,
  },
  GUARD: {
    ACCESS_TOKEN_EXPIRED: 'Access token expired; attempting auto-refresh',
    AUTO_REFRESH_SUCCEEDED:
      'Auto-refresh succeeded; request authorized with new access token',
    CAN_ACTIVATE_FAILED: 'JwtAuthGuard.canActivate failed',
  },
  STRATEGY: {
    VALIDATE_FAILED: 'JwtStrategy.validate failed',
  },
  REPOSITORY: {
    FIND_ONE_OR_FAIL: 'BaseRepository.findOneOrFail failed',
    CREATE_AND_SAVE: 'BaseRepository.createAndSave failed',
    SOFT_REMOVE_OR_FAIL: 'BaseRepository.softRemoveOrFail failed',
  },
  HASH: {
    HASH_PASSWORD_FAILED: 'hashPassword failed',
    COMPARE_PASSWORD_FAILED: 'comparePassword failed',
  },
} as const;
