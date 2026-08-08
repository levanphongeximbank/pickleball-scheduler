/**
 * Canonical Tournament tenant helpers — fail closed, never invent default-tenant.
 */
import { getExplicitTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { TOURNAMENT_REPO_ERROR } from "../repositories/TournamentRepository.interface.js";

export function requireClubId(clubId) {
  const id = String(clubId || "").trim();
  if (!id) {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.MISSING_CLUB,
      error: "Thiếu CLB — không thể thao tác giải đấu.",
    };
  }
  return { ok: true, clubId: id };
}

export function requireExplicitTenantForClub(clubId) {
  const clubCheck = requireClubId(clubId);
  if (!clubCheck.ok) return clubCheck;

  const tenantId = getExplicitTenantIdForClub(clubCheck.clubId);
  if (!tenantId || tenantId === "default-tenant" || tenantId === "default") {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.MISSING_TENANT,
      error: "CLB chưa có tenant hợp lệ — không dùng default-tenant.",
    };
  }
  return { ok: true, clubId: clubCheck.clubId, tenantId };
}
