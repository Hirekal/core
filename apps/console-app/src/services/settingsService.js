import * as organizationService from './organizationService';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
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
