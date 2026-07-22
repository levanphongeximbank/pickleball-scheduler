/**
 * Phase 1I-A / 1J-C — Resolve authenticated session for directory facades.
 *
 * Prefer injected session / user / getters (tests). When none are supplied,
 * fall back to the application auth service (same pattern as other Player
 * Management facades).
 */
import { getCurrentUser as defaultGetCurrentUser } from "../../../auth/authService.js";
import { DIRECTORY_ERROR_CODES } from "../constants/directory.js";
import { trimId } from "../utils/playerId.js";

/**
 * @param {object} [dependencies]
 * @param {object} [dependencies.session] — { user } or user-shaped
 * @param {() => object|null|undefined} [dependencies.getSession]
 * @param {object|null} [dependencies.user]
 * @param {() => object|null|undefined} [dependencies.getCurrentUser]
 * @returns {{ ok: true, user: object, authUserId: string } | { ok: false, code: string, message: string }}
 */
export function resolveDirectorySession(dependencies = {}) {
  let user = null;

  if (dependencies.user !== undefined) {
    user = dependencies.user;
  } else if (dependencies.session !== undefined) {
    const session = dependencies.session;
    user = session?.user ?? session ?? null;
  } else if (typeof dependencies.getSession === "function") {
    const session = dependencies.getSession();
    user = session?.user ?? session ?? null;
  } else if (typeof dependencies.getCurrentUser === "function") {
    user = dependencies.getCurrentUser();
  } else {
    user = defaultGetCurrentUser();
  }

  const authUserId = trimId(user?.id ?? user?.authUserId ?? user?.auth_user_id);
  if (!authUserId) {
    return {
      ok: false,
      code: DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED,
      message: "Authentication required for the player directory",
    };
  }

  return { ok: true, user, authUserId };
}
