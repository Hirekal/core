export const NotificationErrors = {
    NOT_FOUND: (id: string) => `Notification ${id} not found`,
    FAILED_TO_LIST: 'Failed to list notifications',
    FAILED_TO_MARK_READ: 'Failed to mark notification as read',
    FAILED_TO_MARK_ALL_READ: 'Failed to mark all notifications as read',
} as const;

export interface NotifyNewApplicationParams {
    organizationId: string;
    jobId: string;
    jobTitle: string;
    applicationId: string;
    candidateName: string;
}

export interface NotifyStageChangeParams {
    organizationId: string;
    jobId: string;
    jobTitle: string;
    applicationId: string;
    candidateName: string;
    fromStageName: string;
    toStageName: string;
}
