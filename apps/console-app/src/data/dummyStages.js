import { DEFAULT_PIPELINE_STAGES, dummyStages } from '../utils/stages';

export { DEFAULT_PIPELINE_STAGES, dummyStages };

export const defaultJobSettings = {
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
  },
};
