/**
 * Temporary request context until the real auth module is merged.
 * Controllers read organizationId / userId from headers for tenant scoping only.
 * No JWT, login, signup, or session logic lives here.
 */
export interface RequestContext {
  userId: string;
  organizationId: string;
}
