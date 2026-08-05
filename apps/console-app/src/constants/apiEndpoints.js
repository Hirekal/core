/**
 * Central API path builders for the console app.
 * Keep request paths here — services should not hardcode endpoint strings.
 */

export const API_ENDPOINTS = {
  auth: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    verifyCode: '/auth/verify-code',
    resendVerification: '/auth/resend-verification',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    logout: '/auth/logout',
    profile: '/auth/profile',
    changePassword: '/auth/change-password',
    refresh: '/auth/refresh',
  },

  roles: {
    list: '/roles',
  },

  organizations: {
    byId: (organizationId) => `/organizations/${organizationId}`,
  },

  users: {
    list: '/users',
    byOrganization: (organizationId) =>
      `/users?organizationId=${encodeURIComponent(organizationId)}`,
    create: '/users',
    byId: (id) => `/users/${id}`,
  },

  notifications: {
    list: (queryString) => `/notifications?${queryString}`,
    unreadCount: '/notifications/unread-count',
    markRead: (id) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
  },

  jobs: {
    list: (queryString) => `/jobs?${queryString}`,
    create: '/jobs',
    byId: (id) => `/jobs/${id}`,
    preview: (id) => `/jobs/${id}/preview`,
    duplicate: (id) => `/jobs/${id}/duplicate`,
    pause: (id) => `/jobs/${id}/pause`,
    resume: (id) => `/jobs/${id}/resume`,
    archive: (id) => `/jobs/${id}/archive`,
    restore: (id) => `/jobs/${id}/restore`,
    settings: (jobId) => `/jobs/${jobId}/settings`,
    thankYouSettings: (id) => `/jobs/${id}/settings/thank-you`,
    emailAutomationSettings: (id) =>
      `/jobs/${id}/settings/email-automation`,
    webhookSettings: (id) => `/jobs/${id}/settings/webhook`,
    introMedia: (jobId) => `/jobs/${jobId}/media/intro`,
    introUploadUrl: (jobId) => `/jobs/${jobId}/media/intro/upload-url`,
    introConfirm: (jobId) => `/jobs/${jobId}/media/intro/confirm`,
    thankYouMediaUploadUrl: (jobId) =>
      `/jobs/${jobId}/settings/thank-you/media/upload-url`,
    thankYouMediaConfirm: (jobId) =>
      `/jobs/${jobId}/settings/thank-you/media/confirm`,
    stages: (jobId) => `/jobs/${jobId}/stages`,
    stageById: (jobId, stageId) => `/jobs/${jobId}/stages/${stageId}`,
    stagesReorder: (jobId) => `/jobs/${jobId}/stages/reorder`,
  },

  applications: {
    listForJob: (jobId, queryString) =>
      `/jobs/${jobId}/applications${queryString ? `?${queryString}` : ''}`,
    byId: (id) => `/applications/${id}`,
    stage: (id) => `/applications/${id}/stage`,
    rating: (id) => `/applications/${id}/rating`,
    notes: (id) => `/applications/${id}/notes`,
  },

  public: {
    jobBySlug: (slug) => `/public/jobs/${encodeURIComponent(slug)}`,
    jobView: (slug) => `/public/jobs/${encodeURIComponent(slug)}/view`,
    startApplication: (slug) =>
      `/public/jobs/${encodeURIComponent(slug)}/applications/start`,
    applicationById: (id) => `/public/applications/${id}`,
    answer: (applicationId, questionId) =>
      `/public/applications/${applicationId}/answers/${questionId}`,
    videoUploadUrl: (applicationId, questionId) =>
      `/public/applications/${applicationId}/answers/${questionId}/video/upload-url`,
    videoConfirm: (applicationId, questionId) =>
      `/public/applications/${applicationId}/answers/${questionId}/video/confirm`,
    fieldFileUploadUrl: (applicationId, fieldId) =>
      `/public/applications/${applicationId}/fields/${fieldId}/file/upload-url`,
    fieldFileConfirm: (applicationId, fieldId) =>
      `/public/applications/${applicationId}/fields/${fieldId}/file/confirm`,
    submitApplication: (id) => `/public/applications/${id}/submit`,
  },
};
