import { DEFAULT_PIPELINE_STAGES, dummyStages } from '../utils/stages';

export { DEFAULT_PIPELINE_STAGES, dummyStages };

export const defaultJobSettings = {
  general: {
    applicationFormLabel: 'Apply Now',
    instructionsLabel: 'Instructions',
    showQuestionsInAdvance: true,
    socialPreview: {
      siteTitle: '',
      metaDescription: '',
      previewImage: null,
    },
  },
  thankYouPage: {
    mediaType: null,
    mediaUrl: null,
    description: '<p>Thank you for your application! We will review your submission and get back to you soon.</p>',
    autoRedirectUrl: '',
  },
  customStages: DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage })),
  emailAutomation: {
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
  },
  webhook: {
    url: '',
    triggers: {
      newApplication: false,
      stageChange: false,
    },
    includeAnswers: true,
    includeVideoUrls: true,
    includeAiTranscripts: false,
    logs: [
      { id: 'log-1', event: 'New Application', status: 'success', timestamp: '2026-07-20T14:32:00Z', responseCode: 200 },
      { id: 'log-2', event: 'Stage Change', status: 'failed', timestamp: '2026-07-18T09:15:00Z', responseCode: 500 },
      { id: 'log-3', event: 'New Application', status: 'success', timestamp: '2026-07-15T16:45:00Z', responseCode: 200 },
    ],
  },
};
