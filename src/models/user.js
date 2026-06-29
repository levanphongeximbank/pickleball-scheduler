import { isValidRole } from "../auth/roles.js";

export const USER_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended",
  INVITED: "invited",
});

export function normalizeUser(user) {
  const id = String(user?.id || "").trim();
  const role = String(user?.role || "").trim();

  return {
    id,
    email: String(user?.email || "").trim().toLowerCase(),
    displayName: String(user?.displayName || user?.name || "").trim(),
    role: isValidRole(role) ? role : "",
    /** Tenant — bắt buộc với mọi role trừ SUPER_ADMIN. */
    venueId: user?.venueId ? String(user.venueId).trim() : null,
    /** CLB được gán — CLUB_OWNER, PLAYER. */
    clubId: user?.clubId ? String(user.clubId).trim() : null,
    /** Liên kết bản ghi player — PLAYER. */
    playerId: user?.playerId ? String(user.playerId).trim() : null,
    status: user?.status || USER_STATUS.ACTIVE,
    createdAt: user?.createdAt || new Date().toISOString(),
    updatedAt: user?.updatedAt || new Date().toISOString(),
  };
}

export function createUserRecord(fields) {
  const id = fields.id || `user-${Date.now()}`;
  return normalizeUser({
    ...fields,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function isUserActive(user) {
  return user?.status === USER_STATUS.ACTIVE;
}
