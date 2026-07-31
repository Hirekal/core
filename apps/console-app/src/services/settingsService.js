import { dummyNotifications } from '../data/dummyUsers';
import * as organizationService from './organizationService';

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

/** @deprecated Prefer organizationService — kept for older imports */
export async function getOrganization(organizationId) {
    return organizationService.getOrganization(organizationId);
}

/** @deprecated Prefer organizationService — kept for older imports */
export async function getTeamMembers(organizationId, currentUserId) {
    return organizationService.getTeamMembers(organizationId, currentUserId);
}

/** @deprecated Prefer organizationService — kept for older imports */
export async function addTeamMember(data) {
    return organizationService.addTeamMember(data);
}

/** @deprecated Prefer organizationService — kept for older imports */
export async function deleteTeamMember(id, options) {
    return organizationService.deleteTeamMember(id, options);
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
