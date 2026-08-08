/**
 * Access checks against an already-loaded Tournament (cloud authority).
 * Does not read club blob / localStorage.
 */
import { guardClubAccess } from "../../../auth/guardAction.js";
import { guardRecordTenant } from "../../tenant/guards/tenantGuard.js";

/**
 * @param {string} clubId
 * @param {object|null} tournament
 * @param {{ tenantId?: string|null }} [options]
 */
export function assertLoadedTournamentAccess(clubId, tournament, options = {}) {
  const { tenantId = null } = options;
  const access = guardClubAccess(clubId, options);
  if (!access.ok) {
    return {
      ok: false,
      error: access.error,
      code: access.code || "FORBIDDEN",
      tournament: null,
    };
  }

  if (!tournament) {
    return {
      ok: false,
      error: "Không tìm thấy giải.",
      code: "NOT_FOUND",
      tournament: null,
    };
  }

  if (tenantId) {
    const tenantCheck = guardRecordTenant(tournament, tenantId, options);
    if (!tenantCheck.ok) {
      return { ...tenantCheck, tournament: null };
    }
  }

  return { ok: true, tournament };
}
