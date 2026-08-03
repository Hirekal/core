import { Notification } from './entities/notification.entity';

export function toNotificationResponse(
  notification: Notification,
): Record<string, unknown> {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    read: notification.read,
    timestamp: notification.createdAt.toISOString(),
    jobId: notification.jobId,
    applicationId: notification.applicationId,
    candidateId: notification.applicationId,
  };
}
