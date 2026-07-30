import { dummyNotifications } from '../data/dummyUsers';
import { dummyTeamMembers } from '../data/dummyTeamMembers';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

let notificationsStore = [...dummyNotifications];
let teamMembersStore = [...dummyTeamMembers];

function generateOneTimePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 16; i += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

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
    members: teamMembersStore.length,
    jobsCount: 12,
    createdAt: '2025-01-15T00:00:00Z',
  };
}

export async function getTeamMembers() {
  await delay();
  return [...teamMembersStore].sort(
    (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt)
  );
}

export async function addTeamMember({ name, email }) {
  await delay(400);

  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim().toLowerCase();

  if (!trimmedName || !trimmedEmail) {
    throw new Error('Name and email are required');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error('Please enter a valid email address');
  }

  if (teamMembersStore.some((member) => member.email === trimmedEmail)) {
    throw new Error('A team member with this email already exists');
  }

  const oneTimePassword = generateOneTimePassword();
  const member = {
    id: `member-${Date.now()}`,
    name: trimmedName,
    email: trimmedEmail,
    role: 'member',
    status: 'active',
    joinedAt: new Date().toISOString(),
  };

  teamMembersStore = [...teamMembersStore, member];

  return { member, oneTimePassword };
}

export async function deleteTeamMember(id) {
  await delay(300);

  const member = teamMembersStore.find((item) => item.id === id);
  if (!member) {
    throw new Error('Team member not found');
  }

  if (member.role === 'admin') {
    throw new Error('Organization admins cannot be removed');
  }

  teamMembersStore = teamMembersStore.filter((item) => item.id !== id);

  return { success: true };
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
