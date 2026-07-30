export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum RecordStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

export enum UserCodeType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export enum EmailLogStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export const SYSTEM_ROLES = {
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_EXPIRES_IN: '1m',
  REFRESH_TOKEN_EXPIRES_IN: '5m',
  CODE_EXPIRES_IN_MINUTES: 15,
  MAX_CODE_ATTEMPTS: 5,
  BCRYPT_SALT_ROUNDS: 12,
} as const;
