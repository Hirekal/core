import { apiRequest, putToSignedUrl } from './apiClient';
import { mediaToUploadFile } from '../utils/mediaHelpers';
import { fieldToUi, questionToUi } from './jobMappers';
import { defaultJobSettings } from '../data/dummyStages';

const APPLICATION_TOKEN_HEADER = 'x-application-token';

function sessionKey(slug) {
  return `hirekal_apply_${slug}`;
}

export function readApplySession(slug) {
  try {
    const raw = sessionStorage.getItem(sessionKey(slug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeApplySession(slug, session) {
  if (!session) {
    sessionStorage.removeItem(sessionKey(slug));
    return;
  }
  sessionStorage.setItem(sessionKey(slug), JSON.stringify(session));
}

/**
 * Maps public job API response to apply-flow UI shape.
 */
export function publicJobToApplyUi(job) {
  if (!job) return null;

  const settingsEntity = job.settings || null;

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location || '',
    employmentType: job.employmentType || '',
    slug: job.slug,
    candidateIntroTitle: job.candidateIntroTitle || '',
    candidateInstructions: job.candidateInstructions || '',
    applicationSectionTitle: job.applicationSectionTitle || '',
    introMedia: job.introMedia
      ? {
          type: (job.introMedia.type || '').toLowerCase(),
          url: job.introMedia.url,
        }
      : null,
    questions: (job.questions || [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(questionToUi),
    applicationFields: (job.applicationFields || [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(fieldToUi),
    settings: {
      thankYouPage: {
        ...defaultJobSettings.thankYouPage,
        ...(settingsEntity?.thankYouPage || {}),
      },
    },
  };
}

export async function getPublicJob(slug) {
  const job = await apiRequest(`/public/jobs/${encodeURIComponent(slug)}`);
  return publicJobToApplyUi(job);
}

function splitFieldValues(values, fields) {
  const payload = {
    firstName: undefined,
    lastName: undefined,
    email: undefined,
    phone: undefined,
    custom: {},
  };

  for (const field of fields) {
    const value = values[field.id] ?? '';
    if (field.builtIn && ['firstName', 'lastName', 'email', 'phone'].includes(field.id)) {
      payload[field.id] = value;
    } else if (!field.builtIn) {
      payload.custom[field.apiId || field.id] = value;
    }
  }

  return payload;
}

export async function startApplication(slug, values, fields) {
  const fieldsPayload = splitFieldValues(values, fields);
  const { custom, ...builtIn } = fieldsPayload;

  const result = await apiRequest(
    `/public/jobs/${encodeURIComponent(slug)}/applications/start`,
    {
      method: 'POST',
      body: {
        fields: { ...builtIn, custom },
      },
    },
  );

  writeApplySession(slug, {
    id: result.id,
    accessToken: result.accessToken,
  });

  return result;
}

function withApplicationToken(slug, extra = {}) {
  const session = readApplySession(slug);
  if (!session?.accessToken) {
    throw new Error('Application session expired. Please refresh and try again.');
  }
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      [APPLICATION_TOKEN_HEADER]: session.accessToken,
    },
  };
}

export async function updateApplication(slug, values, fields) {
  const session = readApplySession(slug);
  if (!session?.id) {
    throw new Error('Application session not found');
  }

  const fieldsPayload = splitFieldValues(values, fields);
  const { custom, ...builtIn } = fieldsPayload;

  return apiRequest(`/public/applications/${session.id}`, {
    method: 'PATCH',
    ...withApplicationToken(slug),
    body: { ...builtIn, custom },
  });
}

export async function saveTextAnswer(slug, questionId, answerText) {
  const session = readApplySession(slug);
  if (!session?.id) {
    throw new Error('Application session not found');
  }

  return apiRequest(
    `/public/applications/${session.id}/answers/${questionId}`,
    {
      method: 'PATCH',
      ...withApplicationToken(slug),
      body: { answerText },
    },
  );
}

export async function uploadVideoAnswer(slug, questionId, media) {
  const session = readApplySession(slug);
  if (!session?.id) {
    throw new Error('Application session not found');
  }

  const file = await mediaToUploadFile(media);
  if (!file) {
    throw new Error('Recording data is missing. Please record again.');
  }
  const fileName = file.name;
  const contentType = file.type || 'video/webm';

  const presign = await apiRequest(
    `/public/applications/${session.id}/answers/${questionId}/video/upload-url`,
    {
      method: 'POST',
      ...withApplicationToken(slug),
      body: {
        fileName,
        contentType,
        size: file.size,
      },
    },
  );

  await putToSignedUrl(presign.uploadUrl, file, contentType);

  const confirmed = await apiRequest(
    `/public/applications/${session.id}/answers/${questionId}/video/confirm`,
    {
      method: 'POST',
      ...withApplicationToken(slug),
      body: {
        storageKey: presign.storageKey,
        fileName,
        contentType,
      },
    },
  );

  return {
    url: confirmed.mediaUrl,
    type: 'video',
    fileName,
  };
}

export async function submitApplication(slug) {
  const session = readApplySession(slug);
  if (!session?.id) {
    throw new Error('Application session not found');
  }

  const result = await apiRequest(`/public/applications/${session.id}/submit`, {
    method: 'POST',
    ...withApplicationToken(slug),
  });

  writeApplySession(slug, null);
  return result;
}

export async function getJobApplications(jobId, filters = {}) {
  const params = new URLSearchParams();
  if (filters.stageId) params.set('stageId', filters.stageId);
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);

  const query = params.toString();
  const path = `/jobs/${jobId}/applications${query ? `?${query}` : ''}`;

  return apiRequest(path, { auth: true });
}

export async function getApplicationById(id) {
  return apiRequest(`/applications/${id}`, { auth: true });
}

export async function updateApplicationStage(id, stageId) {
  return apiRequest(`/applications/${id}/stage`, {
    method: 'PATCH',
    auth: true,
    body: { stageId },
  });
}

export async function updateApplicationRating(id, rating) {
  return apiRequest(`/applications/${id}/rating`, {
    method: 'PATCH',
    auth: true,
    body: { rating },
  });
}

export async function addApplicationNote(id, text) {
  return apiRequest(`/applications/${id}/notes`, {
    method: 'POST',
    auth: true,
    body: { text },
  });
}

export async function deleteApplication(id) {
  return apiRequest(`/applications/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}
