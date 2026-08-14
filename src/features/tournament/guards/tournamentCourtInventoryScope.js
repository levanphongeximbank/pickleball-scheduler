/**
 * Official/Team court inventory scope — clubId, tenantId, and venueId are distinct.
 * Does not invent venueId from tenantId. Does not invent tenantId from venueId.
 */
import { TOURNAMENT_REPO_ERROR } from "../repositories/TournamentRepository.interface.js";

const FORBIDDEN_TENANTS = new Set(["default-tenant", "default"]);

export const COURT_INVENTORY_SCOPE_ERROR = Object.freeze({
  MISSING_CLUB: TOURNAMENT_REPO_ERROR.MISSING_CLUB,
  MISSING_TENANT: TOURNAMENT_REPO_ERROR.MISSING_TENANT,
  MISSING_VENUE: "COURT_INVENTORY_MISSING_VENUE",
  CLUB_SCOPE_MISMATCH: "COURT_INVENTORY_CLUB_SCOPE_MISMATCH",
  TENANT_SCOPE_MISMATCH: "COURT_INVENTORY_TENANT_SCOPE_MISMATCH",
  TOURNAMENT_REQUIRED: "COURT_INVENTORY_TOURNAMENT_REQUIRED",
});

function trimId(value) {
  return value != null ? String(value).trim() : "";
}

function isForbiddenTenant(id) {
  return !id || FORBIDDEN_TENANTS.has(id);
}

function fail(code, error) {
  return { ok: false, code, error, clubId: "", tenantId: null, venueId: null };
}

/**
 * Authorized tenant from Club / session — not from Tournament tenantId alone.
 */
function resolveAuthorizedTenantId(activeClub, currentTenantId) {
  const clubTenantId = trimId(activeClub?.tenantId);
  if (!isForbiddenTenant(clubTenantId)) {
    return clubTenantId;
  }
  const current = trimId(currentTenantId);
  if (!isForbiddenTenant(current)) {
    return current;
  }
  return "";
}

/**
 * Venue row identity from the canonical Club projection only.
 * Never copied from Tournament.tenantId.
 */
function resolveClubVenueId(activeClub) {
  return trimId(activeClub?.venueId);
}

/**
 * Legacy Official payloads sometimes stored venueId in tenantId.
 * Compatible when that value equals the Club venue projection.
 * Does not rewrite the stored Tournament.
 */
function tournamentTenantMatchesAuthority(tournamentTenantId, authorizedTenantId, clubVenueId) {
  if (!tournamentTenantId) {
    return true;
  }
  if (tournamentTenantId === authorizedTenantId) {
    return true;
  }
  if (clubVenueId && tournamentTenantId === clubVenueId) {
    return true;
  }
  return false;
}

/**
 * @param {{
 *   tournament?: { id?: string, clubId?: string, tenantId?: string }|null,
 *   activeClub?: { id?: string, clubId?: string, tenantId?: string, venueId?: string }|null,
 *   currentTenantId?: string|null,
 * }} params
 * @returns {{
 *   ok: boolean,
 *   clubId: string,
 *   tenantId: string|null,
 *   venueId: string|null,
 *   code?: string,
 *   error?: string,
 * }}
 */
export function resolveTournamentCourtInventoryScope({
  tournament,
  activeClub,
  currentTenantId,
} = {}) {
  if (!tournament || !trimId(tournament.id)) {
    return fail(
      COURT_INVENTORY_SCOPE_ERROR.TOURNAMENT_REQUIRED,
      "Thiếu giải đấu — không tải inventory sân."
    );
  }

  const clubId = trimId(activeClub?.id || activeClub?.clubId);
  if (!clubId) {
    return fail(
      COURT_INVENTORY_SCOPE_ERROR.MISSING_CLUB,
      "Thiếu CLB — không tải inventory sân."
    );
  }

  const tournamentClubId = trimId(tournament.clubId);
  if (tournamentClubId && tournamentClubId !== clubId) {
    return fail(
      COURT_INVENTORY_SCOPE_ERROR.CLUB_SCOPE_MISMATCH,
      "Giải đấu không thuộc CLB đang được phép."
    );
  }

  const authorizedTenantId = resolveAuthorizedTenantId(activeClub, currentTenantId);
  if (isForbiddenTenant(authorizedTenantId)) {
    return fail(
      COURT_INVENTORY_SCOPE_ERROR.MISSING_TENANT,
      "CLB chưa có tenant hợp lệ — không tải inventory sân."
    );
  }

  const current = trimId(currentTenantId);
  const clubVenueId = resolveClubVenueId(activeClub);
  if (current && current !== authorizedTenantId && current !== clubVenueId) {
    return fail(
      COURT_INVENTORY_SCOPE_ERROR.TENANT_SCOPE_MISMATCH,
      "Tenant hiện tại không khớp đơn vị được phép — không tải sân."
    );
  }

  const tournamentTenantId = trimId(tournament.tenantId);
  if (
    !tournamentTenantMatchesAuthority(
      tournamentTenantId,
      authorizedTenantId,
      clubVenueId
    )
  ) {
    return fail(
      COURT_INVENTORY_SCOPE_ERROR.TENANT_SCOPE_MISMATCH,
      "Tenant giải đấu không khớp đơn vị được phép — không tải sân."
    );
  }

  if (isForbiddenTenant(clubVenueId)) {
    return fail(
      COURT_INVENTORY_SCOPE_ERROR.MISSING_VENUE,
      "CLB chưa có venue hợp lệ — không tải inventory sân."
    );
  }

  return {
    ok: true,
    clubId,
    tenantId: authorizedTenantId,
    venueId: clubVenueId,
  };
}
