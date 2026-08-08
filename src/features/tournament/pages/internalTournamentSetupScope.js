/**
 * Canonical club-scope helpers for Internal Tournament setup.
 * Fail closed — never emit ID-only scope or default-tenant.
 */
import { resolveExplicitTenantFromClub } from "../guards/tournamentTenant.js";

export const INTERNAL_SETUP_CLUB_NOT_READY =
  "CLB chưa sẵn sàng (thiếu tenant hợp lệ) — đang chờ ngữ cảnh CLB.";

/**
 * Resolve the only club scope Internal setup may pass into canonical Tournament APIs.
 * Same contract as Daily/Official: ready activeClub object, never `{ id }` alone.
 *
 * @param {{
 *   activeClubReady?: boolean,
 *   clubReadReady?: boolean,
 *   activeClub?: { id?: string, clubId?: string, tenantId?: string|null, venueId?: string|null }|null,
 * }} input
 */
export function resolveInternalSetupCanonicalClubScope(input = {}) {
  const activeClubReady = Boolean(input.activeClubReady);
  const clubReadReady = input.clubReadReady !== false;
  const activeClub = input.activeClub;

  if (!activeClubReady || !clubReadReady) {
    return {
      ok: false,
      code: "CLUB_NOT_READY",
      error: INTERNAL_SETUP_CLUB_NOT_READY,
      scope: null,
      shouldQuery: false,
      clubId: "",
      tenantId: null,
    };
  }

  if (!activeClub || typeof activeClub !== "object") {
    return {
      ok: false,
      code: "CLUB_NOT_READY",
      error: INTERNAL_SETUP_CLUB_NOT_READY,
      scope: null,
      shouldQuery: false,
      clubId: "",
      tenantId: null,
    };
  }

  const clubId = String(activeClub.id || activeClub.clubId || "").trim();
  const tenantId = resolveExplicitTenantFromClub(activeClub);
  if (!clubId || !tenantId) {
    return {
      ok: false,
      code: "CLUB_NOT_READY",
      error: INTERNAL_SETUP_CLUB_NOT_READY,
      scope: null,
      shouldQuery: false,
      clubId: "",
      tenantId: null,
    };
  }

  return {
    ok: true,
    code: null,
    error: null,
    // Pass the canonical activeClub object — do not overwrite id with another club id.
    scope: activeClub,
    shouldQuery: true,
    clubId,
    tenantId,
  };
}

/**
 * Runtime club id for local/UI surfaces after canonical load.
 * Persisted tournament.clubId is authoritative; activeClub.id is the ready fallback.
 * Never uses findTournamentClubId / local blob scan.
 */
export function resolveInternalSetupRuntimeClubId({
  persistedClubId = "",
  activeClubId = "",
} = {}) {
  return String(persistedClubId || activeClubId || "").trim();
}

/**
 * Whether Internal setup should invoke canonical switchClub to match persisted host.
 */
export function shouldAlignActiveClubToPersistedTournament({
  activeClubReady = false,
  activeClubId = "",
  persistedClubId = "",
} = {}) {
  if (!activeClubReady) return false;
  const persisted = String(persistedClubId || "").trim();
  const active = String(activeClubId || "").trim();
  if (!persisted || !active) return false;
  return persisted !== active;
}
