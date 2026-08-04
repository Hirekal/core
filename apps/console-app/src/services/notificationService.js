import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { apiRequest } from './apiClient';

export const NOTIFICATIONS_PAGE_SIZE = 25;

/**
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {Promise<{ items: object[], total: number, page: number, limit: number }>}
 */
export async function getNotifications(params = {}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? NOTIFICATIONS_PAGE_SIZE;
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const data = await apiRequest(API_ENDPOINTS.notifications.list(query), {
    auth: true,
  });

  // Backward-compatible if an older API still returns a bare array.
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      limit: data.length || limit,
    };
  }

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: typeof data?.total === 'number' ? data.total : 0,
    page: typeof data?.page === 'number' ? data.page : page,
    limit: typeof data?.limit === 'number' ? data.limit : limit,
  };
}

export async function getUnreadNotificationCount() {
  const data = await apiRequest(API_ENDPOINTS.notifications.unreadCount, {
    auth: true,
  });
  return typeof data?.count === 'number' ? data.count : 0;
}

export async function markNotificationRead(id) {
  return apiRequest(API_ENDPOINTS.notifications.markRead(id), {
    method: 'PATCH',
    auth: true,
  });
}

export async function markAllNotificationsRead() {
  return apiRequest(API_ENDPOINTS.notifications.markAllRead, {
    method: 'PATCH',
    auth: true,
  });
}
