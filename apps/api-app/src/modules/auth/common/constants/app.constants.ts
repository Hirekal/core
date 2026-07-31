export const HTTP_HEADERS = {
  AUTHORIZATION: 'Authorization',
  REFRESH_TOKEN: 'X-Refresh-Token',
  ACCESS_TOKEN_EXPIRES_AT: 'X-Access-Token-ExpiresAt',
  REFRESH_TOKEN_EXPIRES_AT: 'X-Refresh-Token-Expires-At',
  FORWARDED_FOR: 'x-forwarded-for',
} as const;

export const JWT_EXPIRY_REGEX = /^(\d+)([smhd])$/;

export const JWT_EXPIRY_MULTIPLIERS_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const DEFAULT_JWT_EXPIRY_FALLBACK_MS = 15 * 60 * 1000;

export const ORGANIZATION_NAME_SUFFIX = "'s Organization";

export const EMAIL_LOG_METADATA_KEYS = {
  USER_CODE_ID: 'userCodeId',
} as const;
