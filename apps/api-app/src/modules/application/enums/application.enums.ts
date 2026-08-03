export enum ApplicationStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  ABANDONED = 'ABANDONED',
}

export enum ApplicationSortBy {
  SUBMITTED = 'submitted',
  NAME = 'name',
  STAGE = 'stage',
}

export enum WebhookDeliveryStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
}

export enum WebhookEvent {
  NEW_APPLICATION = 'NEW_APPLICATION',
  STAGE_CHANGE = 'STAGE_CHANGE',
}

export enum JobAnalyticsEventType {
  PAGE_VIEW = 'PAGE_VIEW',
  UNIQUE_VIEW = 'UNIQUE_VIEW',
  APPLICATION_STARTED = 'APPLICATION_STARTED',
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
}

export enum TranscriptionJobStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export const BUILT_IN_FIELD_KEYS = [
  'firstName',
  'lastName',
  'email',
  'phone',
] as const;

export type BuiltInFieldKey = (typeof BUILT_IN_FIELD_KEYS)[number];

export const APPLICATION_TOKEN_HEADER = 'x-application-token';
