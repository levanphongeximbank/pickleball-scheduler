/**
 * Official/Open tenant / organization scope — fail closed.
 * tenantId ≠ organizationId ≠ clubId ≠ venueId
 * Never infer tenantId from venueId.
 */

import { FORBIDDEN_TENANT_IDS } from "./constants.js";

function trimId(value) {
  return value != null ? String(value).trim() : "";
}

function isForbiddenTenant(id) {
  return !id || FORBIDDEN_TENANT_IDS.includes(id);
}

/**
 * Canonical Official/Open tenant. Does not fall back to venueId.
 *
 * @param {{
 *   tournament?: { tenantId?: string|null }|null,
 *   activeClub?: { tenantId?: string|null, venueId?: string|null }|null,
 *   currentTenantId?: string|null,
 * }} [input]
 * @returns {{
 *   ok: boolean,
 *   tenantId: string|null,
 *   organizationId: null,
 *   clubId: string|null,
 *   venueId: string|null,
 *   organizationStatus: "NOT_CONFIGURED",
 *   code?: string,
 *   error?: string,
 * }}
 */
export function resolveOfficialOpenTenantScope(input = {}) {
  const club = input.activeClub && typeof input.activeClub === "object" ? input.activeClub : {};
  const tournament =
    input.tournament && typeof input.tournament === "object" ? input.tournament : {};

  const clubId = trimId(club.id || club.clubId || tournament.clubId) || null;
  const venueId = trimId(club.venueId) || null;
  const organizationId = null;

  const candidates = [
    trimId(input.currentTenantId),
    trimId(club.tenantId),
  ].filter((id) => id && !isForbiddenTenant(id));

  let tenantId = candidates[0] || null;
  const tournamentTenantId = trimId(tournament.tenantId);
  if (
    !tenantId &&
    tournamentTenantId &&
    !isForbiddenTenant(tournamentTenantId) &&
    tournamentTenantId !== venueId
  ) {
    tenantId = tournamentTenantId;
  }

  if (!tenantId) {
    return {
      ok: false,
      tenantId: null,
      organizationId,
      clubId,
      venueId,
      organizationStatus: "NOT_CONFIGURED",
      code: "MISSING_TENANT",
      error: "Official/Open yêu cầu tenantId tường minh — không suy từ venueId.",
    };
  }

  return {
    ok: true,
    tenantId,
    organizationId,
    clubId,
    venueId,
    organizationStatus: "NOT_CONFIGURED",
  };
}

export function distinguishOfficialOpenScopeIds(scope = {}) {
  return Object.freeze({
    tenantId: trimId(scope.tenantId) || null,
    organizationId: trimId(scope.organizationId) || null,
    clubId: trimId(scope.clubId) || null,
    venueId: trimId(scope.venueId) || null,
    distinct:
      trimId(scope.tenantId) !== trimId(scope.venueId) ||
      !trimId(scope.tenantId) ||
      !trimId(scope.venueId),
  });
}

/**
 * Pairing-candidate tenant for Official/Open UI.
 * Empty string when tenant cannot be resolved without venueId inference.
 */
export function resolveOfficialOpenTenantIdOrEmpty(input = {}) {
  const scope = resolveOfficialOpenTenantScope(input);
  return scope.ok ? scope.tenantId : "";
}
