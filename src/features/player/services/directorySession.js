/**
 * Phase 1I-A — Resolve authenticated session for directory facades.
 *
 * Injected session / user only — no hard-coded auth singleton inside callers.
 * Default getCurrentUser is lazy-imported by the caller via deps when needed.
 */
import { DIRECTORY_ERROR_CODES } from "../constants/directory.js";
import { trimId } from "../utils/playerId.js";

/**
 * @param {object} [dependencies]
 * @param {object} [dependencies.session] — { user } or user-shaped
 * @param {() => object|null|undefined} [dependencies.getSession]
 * @param {object} [dependencies.user]
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
