/**
 * Jobs domain enums — single source of truth for allowed values.
 *
 * DB columns store these as varchar (not Postgres ENUM) so adding a new value
 * only requires updating this file + DTOs — no ALTER TYPE migration.
 */
export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
}

export enum JobStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

export enum IntroMediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export enum QuestionRetakes {
  NONE = 'NONE',
  ONE = 'ONE',
  TWO = 'TWO',
  THREE = 'THREE',
  UNLIMITED = 'UNLIMITED',
}

export enum QuestionType {
  TEXT = 'TEXT',
  EMAIL = 'EMAIL',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  SCREEN_RECORDING = 'SCREEN_RECORDING',
  FILE = 'FILE',
  RICH_TEXT = 'RICH_TEXT',
}

export enum QuestionCategory {
  STANDARD = 'STANDARD',
  MEDIA = 'MEDIA',
}

export enum ApplicationFieldType {
  TEXT = 'TEXT',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  URL = 'URL',
  FILE = 'FILE',
}

export enum JobListStatusFilter {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
  ALL = 'ALL',
}

export enum JobSortBy {
  UPDATED_AT = 'updatedAt',
  CREATED_AT = 'createdAt',
  TITLE = 'title',
  APPLICATION_COUNT = 'applicationCount',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}
