import { ConfigService } from '@nestjs/config';
import { Job } from './entities/job.entity';
import { JobSettings } from './job-settings/entities/job-settings.entity';

/**
 * Build share link for a job slug.
 * @param configService
 * @param slug
 * @returns
 */
export function buildShareLink(
  configService: ConfigService,
  slug: string,
): string {
  const baseUrl = configService.get<string>('PUBLIC_APPLY_BASE_URL');
  if (!baseUrl) {
    throw new Error('PUBLIC_APPLY_BASE_URL is required');
  }
  const base = baseUrl.replace(/\/$/, '');
  return `${base}/j/${slug}`;
}

/**
 * Map a job entity to an API response with shareLink and nested relations.
 * @param job
 * @param configService
 * @returns
 */
export function toJobResponse(
  job: Job,
  configService: ConfigService,
): Record<string, unknown> {
  const questions = [...(job.questions ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const applicationFields = [...(job.applicationFields ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const pipelineStages = [...(job.pipelineStages ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return {
    ...job,
    shareLink: buildShareLink(configService, job.slug),
    introMedia: job.introMediaStorageKey
      ? {
          type: job.introMediaType,
          url: job.introMediaUrl,
          storageKey: job.introMediaStorageKey,
          fileName: job.introMediaFileName,
        }
      : null,
    questions,
    applicationFields,
    pipelineStages,
    settings: job.settings ?? null,
  };
}

/**
 * Map job to public apply page response (no internal fields).
 * @param job
 * @param configService
 * @returns
 */
export function toPublicJobResponse(
  job: Job,
  configService: ConfigService,
): Record<string, unknown> {
  const questions = [...(job.questions ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const applicationFields = [...(job.applicationFields ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const settings = job.settings as JobSettings | undefined;

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    companyWebsite: job.companyWebsite,
    location: job.location,
    employmentType: job.employmentType,
    slug: job.slug,
    shareLink: buildShareLink(configService, job.slug),
    candidateIntroTitle: job.candidateIntroTitle,
    candidateInstructions: job.candidateInstructions,
    applicationSectionTitle: job.applicationSectionTitle,
    applyButtonLabel: job.applyButtonLabel ?? 'Start now',
    introMedia: job.introMediaStorageKey
      ? {
          type: job.introMediaType,
          url: job.introMediaUrl,
          storageKey: job.introMediaStorageKey,
          fileName: job.introMediaFileName,
        }
      : null,
    questionRetakes: job.questionRetakes,
    transcriptionLanguage: job.transcriptionLanguage,
    aiTranscripts: job.aiTranscripts,
    questions,
    applicationFields,
    settings: settings
      ? {
          thankYouPage: settings.thankYouPage,
        }
      : null,
  };
}
