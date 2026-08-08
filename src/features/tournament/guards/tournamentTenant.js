/**
 * Canonical Tournament tenant helpers — fail closed, never invent default-tenant.
 * Tenant must come from canonical runtime club projection (activeClub), not localStorage.
 */
import { TOURNAMENT_REPO_ERROR } from "../repositories/TournamentRepository.interface.js";

const FORBIDDEN_TENANTS = new Set(["default-tenant", "default"]);

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

/**
 * Extract explicit tenant from a canonical runtime club object.
 * No localStorage. No guessing. Recognizes tenantId | venueId only.
 * @param {{ tenantId?: string|null, venueId?: string|null }|null|undefined} club
 * @returns {string|null}
 */
export function resolveExplicitTenantFromClub(club) {
  if (!club || typeof club !== "object") {
    return null;
  }
  const raw = club.tenantId ?? club.venueId ?? null;
  const tenantId = String(raw || "").trim();
  if (!tenantId || FORBIDDEN_TENANTS.has(tenantId)) {
    return null;
  }
  return tenantId;
}

/**
 * Build a scope object from ClubContext activeClub only.
 * No id-only fallback — tenant-scoped Tournament must wait for a ready
 * canonical activeClub (id + tenantId|venueId).
 */
export function buildTournamentClubScope(activeClub) {
  if (!activeClub || typeof activeClub !== "object") {
    return {
      id: "",
      clubId: "",
      tenantId: null,
      venueId: null,
    };
  }
  const clubId = String(activeClub.id || activeClub.clubId || "").trim();
  const tenantId = resolveExplicitTenantFromClub(activeClub);
  return {
    id: clubId,
    clubId,
    tenantId,
    venueId: activeClub.venueId ?? tenantId ?? null,
  };
}

/**
 * Normalize clubId string | club scope object | options.tenantId into validated scope.
 * Never reads the legacy club registry for tenant rediscovery.
 */
export function resolveTournamentTenantScope(clubIdOrScope, options = {}) {
  if (clubIdOrScope && typeof clubIdOrScope === "object") {
    const clubCheck = requireClubId(clubIdOrScope.clubId || clubIdOrScope.id);
    if (!clubCheck.ok) return clubCheck;
    const fromClub = resolveExplicitTenantFromClub(clubIdOrScope);
    const tenantId = String(options.tenantId || fromClub || "").trim() || null;
    return requireExplicitTournamentTenant({
      clubId: clubCheck.clubId,
      tenantId,
    });
  }

  const clubCheck = requireClubId(clubIdOrScope);
  if (!clubCheck.ok) return clubCheck;
  return requireExplicitTournamentTenant({
    clubId: clubCheck.clubId,
    tenantId: options.tenantId,
  });
}

/**
 * Preferred Tournament tenant gate — explicit runtime tenant only.
 * @param {{ clubId?: string, tenantId?: string|null }} input
 */
export function requireExplicitTournamentTenant(input = {}) {
  const clubCheck = requireClubId(input.clubId);
  if (!clubCheck.ok) return clubCheck;

  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId || FORBIDDEN_TENANTS.has(tenantId)) {
    return {
      ok: false,
      code: TOURNAMENT_REPO_ERROR.MISSING_TENANT,
      error: "CLB chưa có tenant hợp lệ — không dùng default-tenant.",
    };
  }

  return { ok: true, clubId: clubCheck.clubId, tenantId };
}

/**
 * @deprecated Prefer requireExplicitTournamentTenant / resolveTournamentTenantScope.
 * Kept for export compatibility; requires options.tenantId or a club-scope object.
 * Does not consult the legacy club registry.
 */
export function requireExplicitTenantForClub(clubIdOrScope, options = {}) {
  return resolveTournamentTenantScope(clubIdOrScope, options);
}
