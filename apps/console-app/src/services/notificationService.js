import { apiRequest } from './apiClient';

export async function getNotifications() {
  const data = await apiRequest('/notifications', { auth: true });
  return Array.isArray(data) ? data : [];
}

export async function markNotificationRead(id) {
  return apiRequest(`/notifications/${id}/read`, {
    method: 'PATCH',
    auth: true,
  });
}

export async function markAllNotificationsRead() {
  const data = await apiRequest('/notifications/read-all', {
    method: 'PATCH',
    auth: true,
  });
  return Array.isArray(data) ? data : [];
}
