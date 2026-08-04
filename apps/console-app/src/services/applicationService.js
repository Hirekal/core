import { apiRequest, putToSignedUrl } from './apiClient';
import { mediaToUploadFile } from '../utils/mediaHelpers';
import { fieldToUi, questionToUi, toUiRetakes } from './jobMappers';
import { defaultJobSettings } from '../data/dummyStages';
import { DEFAULT_APPLY_BUTTON_LABEL } from '../components/jobs/jobFormUtils';
import { clearApplyProgress } from '../utils/applyProgress';

const APPLICATION_TOKEN_HEADER = 'x-application-token';
const VIEWER_SESSION_KEY = 'hirekal_viewer_id';

function sessionKey(slug) {
  return `hirekal_apply_${slug}`;
}

/**
 * Stable browser id for unique viewer analytics (persists across tabs/sessions).
 */
export function getViewerSessionId() {
  try {
    let id = localStorage.getItem(VIEWER_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VIEWER_SESSION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function readApplySession(slug) {
  try {
    const key = sessionKey(slug);
    const raw =
      localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Migrate older sessionStorage drafts into localStorage.
    if (!localStorage.getItem(key) && sessionStorage.getItem(key)) {
      localStorage.setItem(key, raw);
      sessionStorage.removeItem(key);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeApplySession(slug, session) {
  const key = sessionKey(slug);
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
  if (!session) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(session));
}

/**
 * Clears apply session + saved step progress after submit (or abandon).
 */
export function clearApplyDraft(slug) {
  writeApplySession(slug, null);
  clearApplyProgress(slug);
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
    applyButtonLabel: job.applyButtonLabel || DEFAULT_APPLY_BUTTON_LABEL,
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
      questionRetakes: toUiRetakes(job.questionRetakes),
    },
  };
}

export async function getPublicJob(slug) {
  const job = await apiRequest(`/public/jobs/${encodeURIComponent(slug)}`);
  return publicJobToApplyUi(job);
}

/** Fire-and-forget page view analytics for visitor / viewer KPIs. */
export async function trackJobView(slug) {
  return apiRequest(`/public/jobs/${encodeURIComponent(slug)}/view`, {
    method: 'POST',
    body: { sessionId: getViewerSessionId() },
  });
}

function isFileFieldType(type) {
  return String(type || '').toLowerCase() === 'file';
}

function serializeCustomFieldValue(field, value) {
  if (isFileFieldType(field.type)) {
    if (typeof File !== 'undefined' && value instanceof File) {
      return undefined;
    }
    if (value && typeof value === 'object' && value.url) {
      return JSON.stringify({
        url: value.url,
        storageKey: value.storageKey || '',
        fileName: value.fileName || '',
        contentType: value.contentType || 'application/pdf',
      });
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return undefined;
  }

  if (value == null) return '';
  return typeof value === 'string' ? value : String(value);
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
      const serialized = serializeCustomFieldValue(field, value);
      if (serialized !== undefined) {
        payload.custom[field.apiId || field.id] = serialized;
      }
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
        sessionId: getViewerSessionId(),
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
    retakeCount: confirmed.retakeCount ?? 0,
    retakesRemaining: confirmed.retakesRemaining ?? null,
  };
}

export async function uploadFieldFile(slug, fieldId, file) {
  const session = readApplySession(slug);
  if (!session?.id) {
    throw new Error('Application session not found');
  }
  if (!(file instanceof File)) {
    throw new Error('A PDF file is required');
  }

  const fileName = file.name || 'resume.pdf';
  const contentType = file.type || 'application/pdf';

  const presign = await apiRequest(
    `/public/applications/${session.id}/fields/${fieldId}/file/upload-url`,
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
    `/public/applications/${session.id}/fields/${fieldId}/file/confirm`,
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
    url: confirmed.url,
    storageKey: confirmed.storageKey,
    fileName: confirmed.fileName || fileName,
    contentType: confirmed.contentType || contentType,
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

  clearApplyDraft(slug);
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
