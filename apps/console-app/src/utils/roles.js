/**
 * @fileoverview Role helpers for the authenticated console user.
 */

export const TEAM_ROLES = {
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
};

/**
 * Returns true when the user has the Admin system role.
 *
 * @param {object | null | undefined} user
 * @returns {boolean}
 */
export function isAdmin(user) {
  if (!user) return false;

  const roleNames = (user.userRoles || [])
    .map((userRole) => userRole.role?.name)
    .filter(Boolean);

  return roleNames.some(
    (name) => String(name).toLowerCase() === TEAM_ROLES.ADMIN.toLowerCase(),
  );
}
