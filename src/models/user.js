import { isValidRole, normalizeRole } from "../auth/roles.js";

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
    role: isValidRole(role) ? normalizeRole(role) : "",
    /** Tenant — bắt buộc với mọi role trừ PLATFORM_ADMIN. venueId giữ tương thích ngược. */
    tenantId: user?.tenantId
      ? String(user.tenantId).trim()
      : user?.venueId
        ? String(user.venueId).trim()
        : null,
    venueId: user?.venueId
      ? String(user.venueId).trim()
      : user?.tenantId
        ? String(user.tenantId).trim()
        : null,
    /** CLB được gán — CLUB_MANAGER, PLAYER. */
    clubId: user?.clubId ? String(user.clubId).trim() : null,
    /** Giải đồng đội — TEAM_CAPTAIN. */
    tournamentId: user?.tournamentId || user?.tournament_id
      ? String(user.tournamentId || user.tournament_id).trim()
      : null,
    teamId: user?.teamId || user?.team_id
      ? String(user.teamId || user.team_id).trim()
      : null,
    /** Liên kết bản ghi player — PLAYER. */
    playerId: user?.playerId ? String(user.playerId).trim() : null,
    phone: user?.phone ? String(user.phone).trim() : "",
    avatarUrl: user?.avatarUrl ? String(user.avatarUrl).trim() : "",
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
