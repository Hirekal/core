import { dummyNotifications } from '../data/dummyUsers';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

let notificationsStore = [...dummyNotifications];

export async function getNotifications() {
  await delay();
  return [...notificationsStore].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
}

export async function markNotificationRead(id) {
  await delay(200);
  const index = notificationsStore.findIndex((n) => n.id === id);
  if (index !== -1) {
    notificationsStore[index] = { ...notificationsStore[index], read: true };
  }
  return notificationsStore[index];
}

export async function markAllNotificationsRead() {
  await delay(300);
  notificationsStore = notificationsStore.map((n) => ({ ...n, read: true }));
  return notificationsStore;
}

export async function getOrganization() {
  await delay();
  return {
    id: 'org-1',
    name: 'Acme Corp',
    plan: 'Professional',
    members: 5,
    jobsCount: 12,
    createdAt: '2025-01-15T00:00:00Z',
  };
}

export async function updateGeneralSettings(jobId, settings) {
  await delay(400);
  void jobId;
  void settings;
  return { success: true };
}

export async function updateThankYouPage(jobId, settings) {
  await delay(400);
  void jobId;
  void settings;
  return { success: true };
}

export async function updateWebhookSettings(jobId, settings) {
  await delay(400);
  void jobId;
  void settings;
  return { success: true };
}
