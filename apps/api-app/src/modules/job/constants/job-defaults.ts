import {
    GeneralSettings,
    ThankYouPageSettings,
    EmailAutomationSettings,
    WebhookSettings,
} from '../job-settings/entities/job-settings.entity';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
    applicationFormLabel: 'Apply Now',
    instructionsLabel: 'Instructions',
    showQuestionsInAdvance: true,
    socialPreview: {
        siteTitle: '',
        metaDescription: '',
        previewImage: { type: 'image', url: '', storageKey: '', fileName: '' },
    },
};

export const DEFAULT_THANK_YOU_PAGE: ThankYouPageSettings = {
    mediaType: null,
    mediaUrl: '',
    storageKey: '',
    fileName: '',
    description:
        '<p>Thank you for your application! We will review your submission and get back to you soon.</p>',
    autoRedirectUrl: '',
};

export const DEFAULT_EMAIL_AUTOMATION: EmailAutomationSettings = {
    inviteApplicants: false,
    verifyApplicantEmail: true,
    incompleteReminders: true,
    confirmationAfterSubmission: true,
    followUpQuestionEmails: false,
    stageBasedEmails: {
        shortlisted: false,
        rejected: false,
        disqualified: false,
    },
};

export const DEFAULT_WEBHOOK_SETTINGS: WebhookSettings = {
    url: '',
    triggers: { newApplication: false, stageChange: false },
    includeAnswers: true,
    includeVideoUrls: true,
    includeAiTranscripts: false,
};

export const DEFAULT_PIPELINE_STAGES = [
    {
        name: 'In Progress',
        slug: 'in-progress',
        sortOrder: 1,
        isDefault: true,
        active: true,
    },
    {
        name: 'To Be Reviewed',
        slug: 'to-be-reviewed',
        sortOrder: 2,
        isDefault: true,
        active: true,
    },
    {
        name: 'Shortlisted',
        slug: 'shortlisted',
        sortOrder: 3,
        isDefault: true,
        active: true,
    },
    {
        name: 'Rejected',
        slug: 'rejected',
        sortOrder: 4,
        isDefault: true,
        active: true,
    },
] as const;

export const DEFAULT_APPLICATION_FIELDS = [
    {
        fieldKey: 'firstName',
        label: 'First Name',
        type: 'TEXT' as const,
        required: true,
        builtIn: true,
        sortOrder: 1,
    },
    {
        fieldKey: 'lastName',
        label: 'Last Name',
        type: 'TEXT' as const,
        required: true,
        builtIn: true,
        sortOrder: 2,
    },
    {
        fieldKey: 'email',
        label: 'Email',
        type: 'EMAIL' as const,
        required: true,
        builtIn: true,
        sortOrder: 3,
    },
    {
        fieldKey: 'phone',
        label: 'Phone Number',
        type: 'PHONE' as const,
        required: false,
        builtIn: true,
        sortOrder: 4,
    },
] as const;

export const BUILT_IN_VIDEO_QUESTION = {
    label: 'Tell me about yourself',
    type: 'VIDEO' as const,
    category: 'MEDIA' as const,
    required: true,
    builtIn: true,
};

export const IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
];

export const VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
];

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
