/**
 * Project explicit canonical tournament/club/tenant into prepareLivePrivatePairingOptions input.
 *
 * Caller-side fix for Daily/Internal pairing scope projection.
 * Does not change resolveLivePairingScope validation semantics.
 *
 * Forbidden: placeholder tenant fallback, browser-storage tenant authority,
 * user venue guessing, ID-only invention.
 */
import { resolveExplicitTenantFromClub } from "../../tournament/guards/tournamentTenant.js";

function normalizeId(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "undefined" || text === "null") {
    return "";
  }
  return text;
}

/**
 * @param {{
 *   tournament?: { id?: string|null, clubId?: string|null, tenantId?: string|null }|null,
 *   activeClub?: { id?: string|null, clubId?: string|null, tenantId?: string|null, venueId?: string|null }|null,
 *   tournamentId?: string|null,
 *   clubId?: string|null,
 *   hostClubId?: string|null,
 *   tenantId?: string|null,
 *   competitionClass?: string|null,
 *   eventId?: string|null,
 *   pairingConstraints?: unknown,
 *   allowedByPublishedRules?: boolean,
 *   envSource?: unknown,
 *   seed?: unknown,
 *   contextTime?: unknown,
 * }} [input]
 */
export function projectLivePrivatePairingPrepareInput(input = {}) {
  const tournament =
    input.tournament && typeof input.tournament === "object" ? input.tournament : null;
  const activeClub =
    input.activeClub && typeof input.activeClub === "object" ? input.activeClub : null;

  const tournamentId =
    normalizeId(input.tournamentId) || normalizeId(tournament?.id) || "";
  const tournamentClubId = normalizeId(tournament?.clubId);
  const hostClubId =
    normalizeId(input.hostClubId) ||
    normalizeId(activeClub?.id) ||
    normalizeId(activeClub?.clubId) ||
    "";
  const clubId =
    tournamentClubId ||
    normalizeId(input.clubId) ||
    hostClubId ||
    "";

  if (tournamentClubId && hostClubId && tournamentClubId !== hostClubId) {
    return {
      ok: false,
      code: "CLUB_SCOPE_MISMATCH",
      error: {
        code: "CLUB_SCOPE_MISMATCH",
        message: `CLB giải (${tournamentClubId}) không khớp CLB chủ nhà canonical (${hostClubId}).`,
        missing: [],
        details: { tournamentClubId, hostClubId },
      },
      tenantId: null,
      clubId: null,
      tournamentId: tournamentId || null,
      prepareInput: null,
    };
  }

  const tournamentTenantId = normalizeId(tournament?.tenantId);
  const clubTenantId = resolveExplicitTenantFromClub(activeClub) || "";
  const explicitTenantId = normalizeId(input.tenantId);

  if (tournamentTenantId && clubTenantId && tournamentTenantId !== clubTenantId) {
    return {
      ok: false,
      code: "TENANT_SCOPE_MISMATCH",
      error: {
        code: "TENANT_SCOPE_MISMATCH",
        message: `Tenant giải (${tournamentTenantId}) không khớp tenant CLB canonical (${clubTenantId}).`,
        missing: [],
        details: { tournamentTenantId, clubTenantId },
      },
      tenantId: null,
      clubId: clubId || null,
      tournamentId: tournamentId || null,
      prepareInput: null,
    };
  }

  // Preferred: tournament.tenantId → aligned activeClub tenantId|venueId → explicit caller tenantId.
  const tenantId = tournamentTenantId || clubTenantId || explicitTenantId || "";

  const missing = [];
  if (!tenantId) missing.push("tenantId");
  if (!tournamentId && !clubId) missing.push("tournamentId|clubId");

  if (missing.length > 0) {
    return {
      ok: false,
      code: "SCOPE_ID_REQUIRED",
      error: {
        code: "SCOPE_ID_REQUIRED",
        message: `Thiếu phạm vi ghép cặp: ${missing.join(", ")}. Kiểm tra giải đã tải (tournamentId), CLB chủ nhà (tournament.clubId) và tenant/venue.`,
        missing,
        details: {
          tournamentId: tournamentId || null,
          clubId: clubId || null,
          tenantId: null,
        },
      },
      tenantId: null,
      clubId: clubId || null,
      tournamentId: tournamentId || null,
      prepareInput: null,
    };
  }

  const prepareInput = {
    tournament,
    tournamentId: tournamentId || null,
    clubId: clubId || null,
    tenantId,
    competitionClass: input.competitionClass ?? null,
  };

  if (input.eventId !== undefined) prepareInput.eventId = input.eventId;
  if (input.pairingConstraints !== undefined) {
    prepareInput.pairingConstraints = input.pairingConstraints;
  }
  if (input.allowedByPublishedRules !== undefined) {
    prepareInput.allowedByPublishedRules = input.allowedByPublishedRules;
  }
  if (input.envSource !== undefined) prepareInput.envSource = input.envSource;
  if (input.seed !== undefined) prepareInput.seed = input.seed;
  if (input.contextTime !== undefined) prepareInput.contextTime = input.contextTime;

  return {
    ok: true,
    code: null,
    error: null,
    tenantId,
    clubId: clubId || null,
    tournamentId: tournamentId || null,
    prepareInput,
  };
}
