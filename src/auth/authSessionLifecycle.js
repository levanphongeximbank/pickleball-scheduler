/**
 * Auth session clear reasons — four distinct operational events.
 * REHYDRATE / identity replace must not destroy tenant/club/cluster preferences.
 */

export const AUTH_SESSION_CLEAR_REASON = Object.freeze({
  /** Explicit sign-out. */
  LOGOUT: "logout",
  /** Different authenticated principal. */
  USER_SWITCH: "user_switch",
  /** Profile/session rejected — treat as hard auth invalidation. */
  AUTH_INVALID: "auth_invalid",
  /**
   * Bootstrap identity wipe only (e.g. replace leftover "dev" session before
   * Supabase restore). Must preserve operational preference hints on F5.
   */
  IDENTITY_REPLACE: "identity_replace",
});

export function shouldClearOperationalContextOnAuthClear(reason) {
  const normalized = String(reason || AUTH_SESSION_CLEAR_REASON.LOGOUT).trim();
  return (
    normalized === AUTH_SESSION_CLEAR_REASON.LOGOUT ||
    normalized === AUTH_SESSION_CLEAR_REASON.USER_SWITCH ||
    normalized === AUTH_SESSION_CLEAR_REASON.AUTH_INVALID
  );
}
