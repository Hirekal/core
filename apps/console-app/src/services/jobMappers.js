import { defaultJobSettings } from '../data/dummyStages';
import { DEFAULT_APPLY_BUTTON_LABEL } from '../components/jobs/jobFormUtils';

const EMPLOYMENT_TO_API = {
    'Full-time': 'FULL_TIME',
    'Part-time': 'PART_TIME',
    Contract: 'CONTRACT',
    Internship: 'INTERNSHIP',
    FULL_TIME: 'FULL_TIME',
    PART_TIME: 'PART_TIME',
    CONTRACT: 'CONTRACT',
    INTERNSHIP: 'INTERNSHIP',
};

const EMPLOYMENT_TO_UI = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACT: 'Contract',
    INTERNSHIP: 'Internship',
};

const STATUS_TO_API = {
    active: 'ACTIVE',
    paused: 'PAUSED',
    archived: 'ARCHIVED',
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    ARCHIVED: 'ARCHIVED',
    all: 'ALL',
    ALL: 'ALL',
};

const STATUS_TO_UI = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    ARCHIVED: 'archived',
};

const RETAKES_TO_API = {
    none: 'NONE',
    '1': 'ONE',
    '2': 'TWO',
    '3': 'THREE',
    unlimited: 'UNLIMITED',
    NONE: 'NONE',
    ONE: 'ONE',
    TWO: 'TWO',
    THREE: 'THREE',
    UNLIMITED: 'UNLIMITED',
};

const RETAKES_TO_UI = {
    NONE: 'none',
    ONE: '1',
    TWO: '2',
    THREE: '3',
    UNLIMITED: 'unlimited',
};

const MEDIA_UI_TYPES = new Set([
    'audio',
    'video',
    'screen-recording',
    'file',
    'rich-text',
]);

const TYPE_TO_API = {
    text: 'TEXT',
    email: 'EMAIL',
    number: 'NUMBER',
    date: 'DATE',
    'multiple-choice': 'MULTIPLE_CHOICE',
    audio: 'AUDIO',
    video: 'VIDEO',
    'screen-recording': 'SCREEN_RECORDING',
    file: 'FILE',
    'rich-text': 'RICH_TEXT',
    phone: 'PHONE',
    url: 'URL',
};

const TYPE_TO_UI = {
    TEXT: 'text',
    EMAIL: 'email',
    NUMBER: 'number',
    DATE: 'date',
    MULTIPLE_CHOICE: 'multiple-choice',
    AUDIO: 'audio',
    VIDEO: 'video',
    SCREEN_RECORDING: 'screen-recording',
    FILE: 'file',
    RICH_TEXT: 'rich-text',
    PHONE: 'phone',
    URL: 'url',
};

const CATEGORY_TO_API = {
    standard: 'STANDARD',
    media: 'MEDIA',
    STANDARD: 'STANDARD',
    MEDIA: 'MEDIA',
};

const CATEGORY_TO_UI = {
    STANDARD: 'standard',
    MEDIA: 'media',
};

const SORT_TO_API = {
    updated: 'updatedAt',
    created: 'createdAt',
    title: 'title',
    applications: 'applicationCount',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
    applicationCount: 'applicationCount',
};

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {string} [id]
 * @returns {boolean}
 */
export function isApiId(id) {
    return typeof id === 'string' && UUID_RE.test(id);
}

/**
 * @param {string} [value]
 * @returns {string|undefined}
 */
export function toApiEmploymentType(value) {
    return EMPLOYMENT_TO_API[value] || undefined;
}

/**
 * @param {string} [value]
 * @returns {string}
 */
export function toUiEmploymentType(value) {
    return EMPLOYMENT_TO_UI[value] || value || '';
}

/**
 * @param {string} [value]
 * @returns {string|undefined}
 */
export function toApiStatus(value) {
    return STATUS_TO_API[value] || undefined;
}

/**
 * @param {string} [value]
 * @returns {string}
 */
export function toUiStatus(value) {
    return STATUS_TO_UI[value] || value?.toLowerCase?.() || value || '';
}

/**
 * @param {string} [value]
 * @returns {string|undefined}
 */
export function toApiRetakes(value) {
    return RETAKES_TO_API[value] || undefined;
}

/**
 * @param {string} [value]
 * @returns {string}
 */
export function toUiRetakes(value) {
    return RETAKES_TO_UI[value] || value || 'unlimited';
}

/**
 * @param {string} [value]
 * @returns {string|undefined}
 */
export function toApiType(value) {
    return TYPE_TO_API[value] || value?.toUpperCase?.();
}

/**
 * @param {string} [value]
 * @returns {string}
 */
export function toUiType(value) {
    return TYPE_TO_UI[value] || value?.toLowerCase?.() || value || 'text';
}

/**
 * @param {string} [value]
 * @returns {string|undefined}
 */
export function toApiCategory(value) {
    return CATEGORY_TO_API[value] || undefined;
}

/**
 * @param {string} [value]
 * @returns {string}
 */
export function toUiCategory(value) {
    return CATEGORY_TO_UI[value] || value?.toLowerCase?.() || 'standard';
}

/**
 * @param {string} [value]
 * @returns {string}
 */
export function toApiSortBy(value) {
    return SORT_TO_API[value] || 'updatedAt';
}

/**
 * Maps pipeline stages from API → UI `customStages` shape.
 *
 * @param {Array} [stages]
 * @returns {Array}
 */
export function stagesToUi(stages = []) {
    return [...stages]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((stage) => ({
            id: stage.id,
            name: stage.name,
            slug: stage.slug,
            order: stage.sortOrder,
            active: stage.active !== false,
            isDefault: Boolean(stage.isDefault),
        }));
}

/**
 * Maps UI question options (string[]) to API object shape.
 *
 * @param {unknown} options
 * @param {string} [type]
 * @returns {Record<string, unknown>|undefined}
 */
export function optionsToApi(options, type) {
    const uiType = toUiType(type);
    if (uiType !== 'multiple-choice') {
        return undefined;
    }

    const choices = Array.isArray(options)
        ? options.filter((item) => typeof item === 'string' && item.trim())
        : Array.isArray(options?.choices)
            ? options.choices.filter((item) => typeof item === 'string' && item.trim())
            : [];

    if (!choices.length) {
        return undefined;
    }

    return { choices };
}

/**
 * Maps API question options object back to UI string[].
 *
 * @param {unknown} options
 * @returns {string[]}
 */
export function optionsToUi(options) {
    if (Array.isArray(options)) {
        return options.filter((item) => typeof item === 'string');
    }
    if (options && typeof options === 'object') {
        if (Array.isArray(options.choices)) {
            return options.choices.filter((item) => typeof item === 'string');
        }
        return Object.values(options).filter((item) => typeof item === 'string');
    }
    return [];
}

/**
 * Maps a question from API → UI.
 *
 * @param {object} question
 * @returns {object}
 */
export function questionToUi(question) {
    return {
        id: question.id,
        label: question.label,
        type: toUiType(question.type),
        category: toUiCategory(question.category),
        required: Boolean(question.required),
        builtIn: Boolean(question.builtIn),
        options: optionsToUi(question.options),
        sortOrder: question.sortOrder,
    };
}

/**
 * Maps an application field from API → UI.
 *
 * @param {object} field
 * @returns {object}
 */
export function fieldToUi(field) {
    return {
        id: field.fieldKey || field.id,
        apiId: field.id,
        fieldKey: field.fieldKey,
        label: field.label,
        type: toUiType(field.type),
        required: Boolean(field.required),
        builtIn: Boolean(field.builtIn),
        sortOrder: field.sortOrder,
    };
}

/**
 * Maps intro media from API → UI.
 *
 * @param {object|null} introMedia
 * @returns {object|null}
 */
export function introMediaToUi(introMedia) {
    if (!introMedia) return null;
    return {
        type: toUiType(introMedia.type) === 'video' ? 'video' : 'image',
        url: introMedia.url || null,
        storageKey: introMedia.storageKey || null,
        fileName: introMedia.fileName || null,
    };
}

/**
 * Maps a full job API response into the UI job shape.
 *
 * @param {object} job
 * @returns {object|null}
 */
export function jobToUi(job) {
    if (!job) return null;

    const settingsEntity = job.settings || null;
    const customStages = stagesToUi(
        job.pipelineStages || settingsEntity?.customStages || [],
    );

    return {
        id: job.id,
        organizationId: job.organizationId,
        title: job.title,
        internalTitle: job.internalTitle || '',
        company: job.company,
        companyWebsite: job.companyWebsite || '',
        location: job.location || '',
        employmentType: toUiEmploymentType(job.employmentType),
        status: toUiStatus(job.status),
        slug: job.slug,
        shareLink: job.shareLink || '',
        applicationCount: job.applicationCount ?? 0,
        visitorCount: job.visitorCount ?? 0,
        viewers: job.viewers ?? 0,
        applicationsStarted: job.applicationsStarted ?? 0,
        applicationsSubmitted: job.applicationsSubmitted ?? 0,
        candidateIntroTitle: job.candidateIntroTitle || '',
        candidateInstructions: job.candidateInstructions || '',
        applicationSectionTitle: job.applicationSectionTitle || '',
        applyButtonLabel: job.applyButtonLabel || DEFAULT_APPLY_BUTTON_LABEL,
        introMedia: introMediaToUi(job.introMedia),
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        questions: (job.questions || [])
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map(questionToUi),
        applicationFields: (job.applicationFields || [])
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map(fieldToUi),
        pipelineStages: stagesToUi(job.pipelineStages || []),
        settings: {
            questionRetakes: toUiRetakes(job.questionRetakes),
            transcriptionLanguage: job.transcriptionLanguage || 'english',
            aiTranscripts: job.aiTranscripts !== false,
            thankYouPage: {
                ...defaultJobSettings.thankYouPage,
                ...(settingsEntity?.thankYouPage || {}),
            },
            customStages: customStages.length
                ? customStages
                : defaultJobSettings.customStages.map((s) => ({ ...s })),
            emailAutomation: {
                ...defaultJobSettings.emailAutomation,
                ...(settingsEntity?.emailAutomation || {}),
            },
            webhook: {
                ...defaultJobSettings.webhook,
                ...(settingsEntity?.webhook || {}),
            },
        },
    };
}

/**
 * Builds create/update job body from UI form payload (without local media blob).
 *
 * @param {object} formData - UI form payload
 * @param {{ includeNested?: boolean }} [options]
 * @returns {object}
 */
export function jobFormToApi(formData, options = {}) {
    const { includeNested = true } = options;
    const settings = formData.settings || {};

    const body = {
        title: formData.title,
        internalTitle: formData.internalTitle || undefined,
        company: formData.company,
        companyWebsite: formData.companyWebsite || undefined,
        location: formData.location || undefined,
        employmentType: toApiEmploymentType(formData.employmentType),
        candidateIntroTitle: formData.candidateIntroTitle || undefined,
        candidateInstructions: formData.candidateInstructions || undefined,
        applicationSectionTitle: formData.applicationSectionTitle || undefined,
        applyButtonLabel: formData.applyButtonLabel || undefined,
        questionRetakes: toApiRetakes(settings.questionRetakes),
        transcriptionLanguage: settings.transcriptionLanguage || undefined,
        aiTranscripts:
            typeof settings.aiTranscripts === 'boolean'
                ? settings.aiTranscripts
                : undefined,
    };

    if (includeNested && Array.isArray(formData.questions)) {
        const builtInVideo = formData.questions.find((q) => q.builtIn);
        const standardQuestions = formData.questions.filter(
            (q) => !q.builtIn && !MEDIA_UI_TYPES.has(q.type),
        );

        body.questions = standardQuestions
            .filter((q) => q.label?.trim())
            .map((q, index) => {
                const payload = {
                    label: q.label.trim(),
                    type: toApiType(q.type),
                    category: toApiCategory(q.category),
                    required: Boolean(q.required),
                    sortOrder: q.sortOrder ?? index,
                };
                const options = optionsToApi(q.options, q.type);
                if (options) {
                    payload.options = options;
                }
                if (isApiId(q.id)) {
                    payload.id = q.id;
                }
                return payload;
            });

        if (builtInVideo?.label?.trim()) {
            const builtInPayload = {
                label: builtInVideo.label.trim(),
                type: toApiType('video'),
                category: toApiCategory('media'),
                required: true,
                sortOrder: builtInVideo.sortOrder ?? body.questions.length,
            };
            if (isApiId(builtInVideo.id)) {
                builtInPayload.id = builtInVideo.id;
            }
            body.questions.push(builtInPayload);
        }
    }

    if (includeNested && Array.isArray(formData.applicationFields)) {
        body.applicationFields = formData.applicationFields.map((field, index) => {
            const payload = {
                label: field.label,
                type: toApiType(field.type),
                required: Boolean(field.required),
                sortOrder: field.sortOrder ?? index,
                fieldKey: field.fieldKey || (field.builtIn ? field.id : undefined),
            };
            if (isApiId(field.apiId)) {
                payload.id = field.apiId;
            } else if (isApiId(field.id)) {
                payload.id = field.id;
            }
            return payload;
        });
    }

    Object.keys(body).forEach((key) => {
        if (body[key] === undefined) delete body[key];
    });

    return body;
}
