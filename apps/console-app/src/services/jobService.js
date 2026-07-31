import { apiRequest, apiUpload } from './apiClient';
import {
    isApiId,
    jobFormToApi,
    jobToUi,
    stagesToUi,
    toApiSortBy,
    toApiStatus,
} from './jobMappers';
import { isLocalMediaUrl } from '../utils/jobMediaStorage';

/**
 * Converts a data/blob URL into a File for multipart upload.
 *
 * @param {{ url?: string, type?: string, fileName?: string }} introMedia
 * @returns {Promise<File|null>}
 */
async function introMediaToFile(introMedia) {
    if (!introMedia?.url || !isLocalMediaUrl(introMedia.url)) {
        return null;
    }

    const response = await fetch(introMedia.url);
    const blob = await response.blob();
    const extension = introMedia.type === 'video' ? 'webm' : 'png';
    const fileName = introMedia.fileName || `intro.${extension}`;
    return new File([blob], fileName, { type: blob.type || `application/octet-stream` });
}

/**
 * Uploads intro media when the UI holds a local data/blob URL.
 * Media failures are returned as warnings so job create/update can still succeed.
 *
 * @param {string} jobId
 * @param {object|null|undefined} introMedia
 * @returns {Promise<{ warning?: string }>}
 */
async function syncIntroMedia(jobId, introMedia) {
    try {
        if (introMedia === null) {
            await apiRequest(`/jobs/${jobId}/media/intro`, {
                method: 'DELETE',
                auth: true,
            });
            return {};
        }

        const file = await introMediaToFile(introMedia);
        if (!file) {
            return {};
        }

        await apiUpload(`/jobs/${jobId}/media/intro`, file);
        return {};
    } catch (error) {
        return {
            warning:
                error.message ||
                'Job saved, but intro media upload failed. Configure Cloudflare R2 or remove the intro media.',
        };
    }
}

/**
 * Syncs UI custom stages to the job stages API.
 *
 * @param {string} jobId
 * @param {Array} customStages
 * @returns {Promise<Array>}
 */
async function syncPipelineStages(jobId, customStages = []) {
    const existing = await apiRequest(`/jobs/${jobId}/stages`, { auth: true });
    const existingList = Array.isArray(existing) ? existing : [];
    const existingById = new Map(existingList.map((stage) => [stage.id, stage]));
    const keepIds = [];

    for (let index = 0; index < customStages.length; index += 1) {
        const stage = customStages[index];
        const sortOrder = stage.order ?? index + 1;

        if (isApiId(stage.id) && existingById.has(stage.id)) {
            await apiRequest(`/jobs/${jobId}/stages/${stage.id}`, {
                method: 'PATCH',
                auth: true,
                body: {
                    name: stage.name,
                    active: stage.active !== false,
                    sortOrder,
                },
            });
            keepIds.push(stage.id);
        } else {
            const created = await apiRequest(`/jobs/${jobId}/stages`, {
                method: 'POST',
                auth: true,
                body: {
                    name: stage.name,
                    active: stage.active !== false,
                    sortOrder,
                },
            });
            keepIds.push(created.id);
        }
    }

    for (const stage of existingList) {
        if (!keepIds.includes(stage.id) && !stage.isDefault) {
            await apiRequest(`/jobs/${jobId}/stages/${stage.id}`, {
                method: 'DELETE',
                auth: true,
            });
        }
    }

    if (keepIds.length) {
        await apiRequest(`/jobs/${jobId}/stages/reorder`, {
            method: 'PATCH',
            auth: true,
            body: { stageIds: keepIds },
        });
    }

    const refreshed = await apiRequest(`/jobs/${jobId}/stages`, { auth: true });
    return stagesToUi(Array.isArray(refreshed) ? refreshed : []);
}

/**
 * Caches a job snapshot for the public-style preview route (best-effort).
 *
 * @param {object} job
 */
export async function cacheJobForPreview(job) {
    if (!job?.id) return;
    try {
        localStorage.setItem(`hirekal_preview_${job.id}`, JSON.stringify(job));
    } catch {
        // ignore quota errors
    }
}

/**
 * Loads a job for the application preview page.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getJobForPreview(id) {
    try {
        const cached = localStorage.getItem(`hirekal_preview_${id}`);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch {
        // ignore
    }

    const data = await apiRequest(`/jobs/${id}/preview`, { auth: true });
    return jobToUi({ ...data, status: data.status || 'ACTIVE' });
}

/**
 * Lists jobs for the current organization.
 *
 * @param {object} [filters]
 * @returns {Promise<object[]>}
 */
export async function getJobs(filters = {}) {
    const params = new URLSearchParams();

    const status = toApiStatus(filters.status || 'all');
    if (status) params.set('status', status);

    if (filters.search) params.set('search', filters.search);
    params.set('sortBy', toApiSortBy(filters.sortBy || 'updated'));
    params.set('order', 'desc');
    params.set('page', String(filters.page || 1));
    params.set('limit', String(filters.limit || 100));

    const data = await apiRequest(`/jobs?${params.toString()}`, { auth: true });
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return items.map(jobToUi);
}

/**
 * Fetches a full job by id.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getJobById(id) {
    const data = await apiRequest(`/jobs/${id}`, { auth: true });
    return jobToUi(data);
}

/**
 * Creates a job, then uploads intro media when needed.
 *
 * @param {object} jobData
 * @returns {Promise<object>}
 */
export async function createJob(jobData) {
    const body = jobFormToApi(jobData, { includeNested: true });
    const created = await apiRequest('/jobs', {
        method: 'POST',
        auth: true,
        body,
    });

    let warning;
    if (jobData.introMedia?.url && isLocalMediaUrl(jobData.introMedia.url)) {
        ({ warning } = await syncIntroMedia(created.id, jobData.introMedia));
    }

    const job = await getJobById(created.id);
    if (warning) job.mediaWarning = warning;
    return job;
}

/**
 * Updates a job and optional nested questions/fields; syncs intro media.
 *
 * @param {string} id
 * @param {object} jobData
 * @returns {Promise<object|null>}
 */
export async function updateJob(id, jobData) {
    const body = jobFormToApi(jobData, { includeNested: true });
    await apiRequest(`/jobs/${id}`, {
        method: 'PATCH',
        auth: true,
        body,
    });

    let warning;
    if (jobData.introMedia !== undefined) {
        ({ warning } = await syncIntroMedia(id, jobData.introMedia));
    }

    const job = await getJobById(id);
    if (warning) job.mediaWarning = warning;
    return job;
}

/**
 * Duplicates a job on the server.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function duplicateJob(id) {
    const data = await apiRequest(`/jobs/${id}/duplicate`, {
        method: 'POST',
        auth: true,
    });
    return jobToUi(data);
}

/**
 * Persists job settings sections and pipeline stages.
 *
 * @param {string} id
 * @param {object} settings
 * @returns {Promise<object|null>}
 */
export async function updateJobSettings(id, settings) {
    const {
        general,
        thankYouPage,
        emailAutomation,
        webhook,
        customStages,
        questionRetakes,
        transcriptionLanguage,
        aiTranscripts,
    } = settings || {};

    await apiRequest(`/jobs/${id}`, {
        method: 'PATCH',
        auth: true,
        body: jobFormToApi(
            {
                settings: {
                    questionRetakes,
                    transcriptionLanguage,
                    aiTranscripts,
                },
            },
            { includeNested: false },
        ),
    });

    if (general) {
        await apiRequest(`/jobs/${id}/settings/general`, {
            method: 'PATCH',
            auth: true,
            body: general,
        });
    }

    if (thankYouPage) {
        const { mediaType, mediaUrl, storageKey, fileName, description, autoRedirectUrl } =
            thankYouPage;
        await apiRequest(`/jobs/${id}/settings/thank-you`, {
            method: 'PATCH',
            auth: true,
            body: {
                mediaType,
                mediaUrl,
                storageKey,
                fileName,
                description,
                autoRedirectUrl,
            },
        });
    }

    if (emailAutomation) {
        await apiRequest(`/jobs/${id}/settings/email-automation`, {
            method: 'PATCH',
            auth: true,
            body: emailAutomation,
        });
    }

    if (webhook) {
        const { logs: _logs, ...webhookBody } = webhook;
        await apiRequest(`/jobs/${id}/settings/webhook`, {
            method: 'PATCH',
            auth: true,
            body: webhookBody,
        });
    }

    if (Array.isArray(customStages)) {
        await syncPipelineStages(id, customStages);
    }

    return getJobById(id);
}

/**
 * Placeholder CSV export (candidates API not wired yet).
 *
 * @param {string} jobId
 * @returns {Promise<{ success: boolean, filename: string }>}
 */
export async function exportApplicationsCsv(jobId) {
    return { success: true, filename: `applications-${jobId}.csv` };
}

/**
 * Soft-deletes an archived job.
 *
 * @param {string} id
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteJob(id) {
    await apiRequest(`/jobs/${id}`, {
        method: 'DELETE',
        auth: true,
    });
    try {
        localStorage.removeItem(`hirekal_preview_${id}`);
    } catch {
        // ignore
    }
    return { success: true };
}

/**
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function pauseJob(id) {
    const data = await apiRequest(`/jobs/${id}/pause`, {
        method: 'POST',
        auth: true,
    });
    return jobToUi(data);
}

/**
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function resumeJob(id) {
    const data = await apiRequest(`/jobs/${id}/resume`, {
        method: 'POST',
        auth: true,
    });
    return jobToUi(data);
}

/**
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function archiveJob(id) {
    const data = await apiRequest(`/jobs/${id}/archive`, {
        method: 'POST',
        auth: true,
    });
    return jobToUi(data);
}

/**
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function restoreJob(id) {
    const data = await apiRequest(`/jobs/${id}/restore`, {
        method: 'POST',
        auth: true,
    });
    return jobToUi(data);
}
