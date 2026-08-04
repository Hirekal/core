import { apiRequest } from './apiClient';
import { getJobs } from './jobService';

export const TEAM_ROLES = {
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
};

/**
 * Generates a temporary password for invited team members.
 *
 * @returns {string} Random 16-character password
 */
function generateOneTimePassword() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 16; i += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Picks the primary display role from API userRoles.
 *
 * @param {object} user
 * @returns {string}
 */
function resolveRoleName(user) {
  const roleNames = (user.userRoles || [])
    .map((ur) => ur.role?.name)
    .filter(Boolean);

  const admin = roleNames.find(
    (name) => String(name).toLowerCase() === 'admin',
  );
  if (admin) return TEAM_ROLES.ADMIN;

  const recruiter = roleNames.find(
    (name) => String(name).toLowerCase() === 'recruiter',
  );
  if (recruiter) return TEAM_ROLES.RECRUITER;

  return roleNames[0] || TEAM_ROLES.RECRUITER;
}

/**
 * Maps an API user into the organization team-member UI shape.
 *
 * @param {object} user - API user
 * @param {string} [currentUserId] - Logged-in user id
 * @returns {object}
 */
function toTeamMember(user, currentUserId) {
  const role = resolveRoleName(user);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    status: String(user.status || 'ACTIVE').toLowerCase(),
    joinedAt: user.createdAt,
    organizationId: user.organizationId,
    isCurrentUser: Boolean(currentUserId && user.id === currentUserId),
  };
}

/**
 * Loads assignable system roles (Admin, Recruiter) for the invite form.
 *
 * @returns {Promise<Array<{ value: string, label: string }>>}
 */
export async function getAssignableRoles() {
  const roles = await apiRequest('/roles', { auth: true });
  const list = Array.isArray(roles) ? roles : [];
  const allowed = new Set([
    TEAM_ROLES.ADMIN.toLowerCase(),
    TEAM_ROLES.RECRUITER.toLowerCase(),
  ]);

  const options = list
    .filter((role) => allowed.has(String(role.name || '').toLowerCase()))
    .map((role) => ({
      value: role.name,
      label: role.name,
    }));

  if (options.length > 0) {
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }

  return [
    { value: TEAM_ROLES.ADMIN, label: TEAM_ROLES.ADMIN },
    { value: TEAM_ROLES.RECRUITER, label: TEAM_ROLES.RECRUITER },
  ];
}

/**
 * Loads the current user's organization with member/job stats.
 *
 * @param {string} organizationId
 * @returns {Promise<object>}
 */
export async function getOrganization(organizationId) {
  if (!organizationId) {
    throw new Error('Organization not found for current user');
  }

  const [org, members, jobs] = await Promise.all([
    apiRequest(`/organizations/${organizationId}`, { auth: true }),
    apiRequest(
      `/users?organizationId=${encodeURIComponent(organizationId)}`,
      { auth: true },
    ),
    getJobs({ status: 'active', limit: 100 }).catch(() => []),
  ]);

  const memberList = Array.isArray(members) ? members : [];

  return {
    id: org.id,
    name: org.name,
    status: org.status,
    plan: org.metadata?.plan || 'Standard',
    members: memberList.length,
    jobsCount: Array.isArray(jobs) ? jobs.length : 0,
    createdAt: org.createdAt,
    metadata: org.metadata || {},
  };
}

/**
 * Lists team members for an organization.
 *
 * @param {string} organizationId
 * @param {string} [currentUserId]
 * @returns {Promise<object[]>}
 */
export async function getTeamMembers(organizationId, currentUserId) {
  if (!organizationId) return [];

  const users = await apiRequest(
    `/users?organizationId=${encodeURIComponent(organizationId)}`,
    { auth: true },
  );

  return (Array.isArray(users) ? users : [])
    .map((user) => toTeamMember(user, currentUserId))
    .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
}

/**
 * Invites/creates a team member in the current organization.
 *
 * @param {{ name: string, email: string, role?: string }} payload
 * @returns {Promise<{ member: object, oneTimePassword: string }>}
 */
export async function addTeamMember({ name, email, role }) {
  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim().toLowerCase();
  const selectedRole = role || TEAM_ROLES.RECRUITER;

  if (!trimmedName || !trimmedEmail) {
    throw new Error('Name and email are required');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error('Please enter a valid email address');
  }

  const oneTimePassword = generateOneTimePassword();

  const user = await apiRequest('/users', {
    method: 'POST',
    auth: true,
    body: {
      name: trimmedName,
      email: trimmedEmail,
      password: oneTimePassword,
      emailVerified: true,
      role: selectedRole,
    },
  });

  return {
    member: toTeamMember(user),
    oneTimePassword,
  };
}

/**
 * Removes a team member (soft-delete user).
 *
 * @param {string} id
 * @param {{ currentUserId?: string, role?: string }} [options]
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteTeamMember(id, options = {}) {
  if (options.currentUserId && id === options.currentUserId) {
    throw new Error('You cannot remove yourself from the organization');
  }
  if (String(options.role || '').toLowerCase() === 'admin') {
    throw new Error('Organization admins cannot be removed');
  }

  await apiRequest(`/users/${id}`, {
    method: 'DELETE',
    auth: true,
  });

  return { success: true };
}

/**
 * Updates the organization display name (and optional metadata).
 *
 * @param {string} organizationId
 * @param {{ name?: string, metadata?: object }} payload
 * @returns {Promise<object>}
 */
export async function updateOrganization(organizationId, payload) {
  return apiRequest(`/organizations/${organizationId}`, {
    method: 'PATCH',
    auth: true,
    body: payload,
  });
}
