import { apiRequest } from './apiClient';
import {
    isApiId,
    jobFormToApi,
    jobToUi,
    stagesToUi,
    toApiSortBy,
    toApiStatus,
} from './jobMappers';
import { isLocalMediaUrl } from '../utils/jobMediaStorage';
import {
    mediaToFile,
    uploadFileViaPresignedUrl,
} from './r2UploadService';

const MEDIA_UPLOAD_WARNING =
    'Job saved, but media could not be uploaded to Cloudflare R2. Check R2 API token permissions (Object Read & Write on R2_BUCKET_NAME), bucket CORS for your console URL, and R2_PUBLIC_BASE_URL.';

/**
 * Uploads intro media directly to R2 when the UI holds a local data/blob URL.
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

        if (!introMedia?.url || !isLocalMediaUrl(introMedia.url)) {
            return {};
        }

        const file = await mediaToFile(introMedia);
        if (!file) {
            return {};
        }

        await uploadFileViaPresignedUrl(
            `/jobs/${jobId}/media/intro/upload-url`,
            `/jobs/${jobId}/media/intro/confirm`,
            file,
        );
        return {};
    } catch (error) {
        return {
            warning: error.message || MEDIA_UPLOAD_WARNING,
        };
    }
}

/**
 * Uploads thank-you page media directly to R2 when local.
 *
 * @param {string} jobId
 * @param {object} thankYouPage
 * @returns {Promise<object>} thankYouPage with R2 URLs when uploaded
 */
async function syncThankYouMedia(jobId, thankYouPage) {
    if (!thankYouPage?.mediaUrl || !isLocalMediaUrl(thankYouPage.mediaUrl)) {
        return thankYouPage;
    }

    const file = await mediaToFile({
        url: thankYouPage.mediaUrl,
        type: thankYouPage.mediaType || 'image',
        fileName: thankYouPage.fileName,
    });
    if (!file) return thankYouPage;

    const confirmed = await uploadFileViaPresignedUrl(
        `/jobs/${jobId}/settings/thank-you/media/upload-url`,
        `/jobs/${jobId}/settings/thank-you/media/confirm`,
        file,
    );

    return {
        ...thankYouPage,
        mediaType: confirmed.mediaType,
        mediaUrl: confirmed.mediaUrl,
        storageKey: confirmed.storageKey,
        fileName: confirmed.fileName,
    };
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
 * Always fetches fresh data from the API so intro media and fields match the DB.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getJobForPreview(id) {
    try {
        const data = await apiRequest(`/jobs/${id}/preview`, { auth: true });
        const job = jobToUi({ ...data, status: data.status || 'ACTIVE' });
        await cacheJobForPreview(job);
        return job;
    } catch (error) {
        try {
            const cached = localStorage.getItem(`hirekal_preview_${id}`);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch {
            // ignore
        }
        throw error;
    }
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

const WEBHOOK_EVENT_LABELS = {
    NEW_APPLICATION: 'New Application',
    STAGE_CHANGE: 'Stage Change',
};

/**
 * Maps webhook delivery log API rows to the settings UI table shape.
 *
 * @param {object} log
 * @returns {object}
 */
export function webhookLogToUi(log) {
    const normalized = (log.status || '').toLowerCase();
    const status =
        normalized === 'success'
            ? 'success'
            : normalized === 'pending'
              ? 'pending'
              : 'failed';

    return {
        id: log.id,
        event: WEBHOOK_EVENT_LABELS[log.event] || log.event || 'Webhook',
        status,
        responseCode: log.responseStatus ?? '—',
        timestamp: log.createdAt,
        applicationId: log.applicationId,
        errorMessage: log.errorMessage,
    };
}

/**
 * Maps webhook delivery errors to user-friendly copy (never raw HTTP paths).
 *
 * @param {Error & { status?: number }} error
 * @returns {string}
 */
function toFriendlyWebhookLogError(error) {
    if (error?.status === 401 || error?.status === 403) {
        return 'You do not have permission to view delivery logs for this job.';
    }
    if (/failed to fetch|network/i.test(error?.message || '')) {
        return 'Could not reach the server. Check your connection and try again.';
    }
    return 'Unable to load delivery logs for this job. Please try again.';
}

/**
 * Fetches recent webhook delivery logs for a job.
 *
 * @param {string} jobId
 * @returns {Promise<object[]>}
 */
export async function getWebhookLogs(jobId) {
    try {
        const data = await apiRequest(`/jobs/${jobId}/settings`, { auth: true });
        const logs = data?.webhookLogs;
        return Array.isArray(logs) ? logs.map(webhookLogToUi) : [];
    } catch (error) {
        const friendly = new Error(toFriendlyWebhookLogError(error));
        friendly.status = error?.status;
        throw friendly;
    }
}

/**
 * Creates a job, then uploads intro media directly to R2 when needed.
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
 * Updates a job and optional nested questions/fields; syncs intro media via R2.
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
 * Local media is uploaded directly to R2 before JSON patches.
 *
 * @param {string} id
 * @param {object} settings
 * @returns {Promise<object|null>}
 */
export async function updateJobSettings(id, settings) {
    const {
        thankYouPage,
        emailAutomation,
        webhook,
        customStages,
        questionRetakes,
        transcriptionLanguage,
        aiTranscripts,
    } = settings || {};

    let mediaWarning;

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

    let resolvedThankYou = thankYouPage;

    try {
        if (thankYouPage?.mediaUrl && isLocalMediaUrl(thankYouPage.mediaUrl)) {
            resolvedThankYou = await syncThankYouMedia(id, thankYouPage);
        }
    } catch (error) {
        mediaWarning = error.message || MEDIA_UPLOAD_WARNING;
    }

    if (resolvedThankYou) {
        const {
            mediaType,
            mediaUrl,
            storageKey,
            fileName,
            description,
            autoRedirectUrl,
        } = resolvedThankYou;
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
        const {
            logs: _logs,
            url,
            secret,
            triggers,
            includeAnswers,
            includeVideoUrls,
            includeAiTranscripts,
        } = webhook;
        await apiRequest(`/jobs/${id}/settings/webhook`, {
            method: 'PATCH',
            auth: true,
            body: {
                url,
                secret,
                triggers,
                includeAnswers,
                includeVideoUrls,
                includeAiTranscripts,
            },
        });
    }

    if (Array.isArray(customStages)) {
        await syncPipelineStages(id, customStages);
    }

    const job = await getJobById(id);
    if (mediaWarning) job.mediaWarning = mediaWarning;
    return job;
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
