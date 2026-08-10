/**
 * Captain portal access policy — independent of public/schedule publication.
 *
 * Server enforcement lands in W2 SQL. Client gate is fail-closed defense-in-depth.
 */

/**
 * Explicit true only. Missing/null/undefined/false → disabled.
 * Client must never invent true when server key is absent.
 * @param {object|null|undefined} settingsOrTeamData
 * @returns {boolean}
 */
export function isCaptainAccessEnabled(settingsOrTeamData) {
  if (!settingsOrTeamData || typeof settingsOrTeamData !== "object") {
    return false;
  }
  const settings =
    settingsOrTeamData.settings && typeof settingsOrTeamData.settings === "object"
      ? settingsOrTeamData.settings
      : settingsOrTeamData;
  return settings.captainAccessEnabled === true;
}

/**
 * Pure captain portal access evaluation (no UI/auth hooks).
 * Fail closed when identity/team ownership cannot be proven.
 *
 * @param {object} input
 * @param {object|null} [input.tournament]
 * @param {object|null} [input.teamData]
 * @param {string|null} [input.viewerPlayerId]
 * @param {{ ok: boolean, error?: string }|null} [input.tenantCheck]
 * @param {(teamData: object, playerId: string) => object|null} input.findTeamForCaptain
 * @returns {{
 *   allowed: boolean,
 *   captainTeam: object|null,
 *   viewerPlayerId: string|null,
 *   captainAccessEnabled: boolean,
 *   error: string|null,
 *   code: string|null
 * }}
 */
export function evaluateCaptainPortalAccess({
  tournament = null,
  teamData = null,
  viewerPlayerId = null,
  tenantCheck = null,
  findTeamForCaptain,
} = {}) {
  if (!tournament) {
    return {
      allowed: false,
      captainTeam: null,
      viewerPlayerId: null,
      captainAccessEnabled: false,
      error: "Không tìm thấy giải đấu.",
      code: "NOT_FOUND",
    };
  }

  if (tenantCheck && tenantCheck.ok === false) {
    return {
      allowed: false,
      captainTeam: null,
      viewerPlayerId: viewerPlayerId || null,
      captainAccessEnabled: isCaptainAccessEnabled(teamData || tournament),
      error: tenantCheck.error || "Không có quyền tenant.",
      code: "TENANT_DENIED",
    };
  }

  const captainAccessEnabled = isCaptainAccessEnabled(teamData || tournament);
  if (!captainAccessEnabled) {
    return {
      allowed: false,
      captainTeam: null,
      viewerPlayerId: viewerPlayerId || null,
      captainAccessEnabled: false,
      error: "Portal đội trưởng chưa được mở.",
      code: "captain_portal_closed",
    };
  }

  const normalizedPlayerId = viewerPlayerId ? String(viewerPlayerId).trim() : "";
  if (!normalizedPlayerId) {
    return {
      allowed: false,
      captainTeam: null,
      viewerPlayerId: null,
      captainAccessEnabled: true,
      error: "Không xác định được danh tính vận động viên.",
      code: "IDENTITY_UNPROVEN",
    };
  }

  if (typeof findTeamForCaptain !== "function") {
    return {
      allowed: false,
      captainTeam: null,
      viewerPlayerId: normalizedPlayerId,
      captainAccessEnabled: true,
      error: "Không xác định được đội trưởng.",
      code: "IDENTITY_UNPROVEN",
    };
  }

  const captainTeam = findTeamForCaptain(teamData || {}, normalizedPlayerId);
  if (!captainTeam) {
    return {
      allowed: false,
      captainTeam: null,
      viewerPlayerId: normalizedPlayerId,
      captainAccessEnabled: true,
      error: "Chỉ đội trưởng hoặc đội phó mới truy cập được trang này.",
      code: "captain_scope_denied",
    };
  }

  return {
    allowed: true,
    captainTeam,
    viewerPlayerId: normalizedPlayerId,
    captainAccessEnabled: true,
    error: null,
    code: null,
  };
}
