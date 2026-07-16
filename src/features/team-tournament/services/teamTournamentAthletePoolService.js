/**
 * Single canonical athlete-pool pipeline for Team Tournament selectors.
 *
 * All TT athlete pickers (Internal, AI builder, manual add, TeamRosterPanel,
 * substitutes) must call listAvailableAthletes — never call pairing adapters
 * or blob loaders directly from UI.
 */

import {
  buildCandidateDiagnosticCounts,
  loadClubPairingCandidatePool,
  loadTenantPairingCandidatePool,
  resolvePairingScopeTenantId,
  isPlaceholderTenantId,
  PAIRING_CANDIDATE_REASON_CODES,
} from "../../pairing-candidates/index.js";
import { getPlayerGenderKey } from "../../../models/player.js";

export const TEAM_TOURNAMENT_ATHLETE_SCOPE = Object.freeze({
  CLUB: "club",
  TENANT: "tenant",
});

export const TEAM_TOURNAMENT_ATHLETE_POOL_VERSION = "tt-v6-unified-1";

function normalizeId(value) {
  return String(value || "").trim();
}

function athleteKey(player) {
  return normalizeId(player?.athleteId || player?.pairingIdentityId || player?.id);
}

/**
 * Locked clubId precedence for Team Tournament screens.
 *
 * @param {{
 *   tournamentClubId?: string|null,
 *   clubFromQuery?: string|null,
 *   selectedClubId?: string|null,
 *   activeClubId?: string|null,
 * }} input
 * @returns {string}
 */
export function resolveTeamTournamentAthleteClubId(input = {}) {
  return (
    normalizeId(input.tournamentClubId) ||
    normalizeId(input.clubFromQuery) ||
    normalizeId(input.selectedClubId) ||
    normalizeId(input.activeClubId) ||
    ""
  );
}

/**
 * Locked tenant resolution — never invents default-tenant.
 *
 * @param {object} input
 * @returns {string|null}
 */
export function resolveTeamTournamentAthleteTenantId(input = {}) {
  return resolvePairingScopeTenantId({
    tournamentTenantId: input.tournamentTenantId || input.tournament?.tenantId,
    club: input.club,
    clubId: input.clubId,
    clubs: input.clubs,
    currentTenantId: input.currentTenantId,
  });
}

/**
 * @param {object} gatewayDiagnostics
 * @param {object} extras
 */
function enrichDiagnostics(gatewayDiagnostics, extras = {}) {
  const base = gatewayDiagnostics || {
    sourceCount: 0,
    membershipCount: 0,
    activeMembershipCount: 0,
    eligibleCount: 0,
    wrongScopeCount: 0,
    membershipInactiveCount: 0,
    missingIdentityCount: 0,
  };

  const byReason = extras.byReason || {};
  return {
    ...base,
    identityMappedCount: Number(
      extras.identityMappedCount ?? base.identityMappedCount ?? 0
    ),
    identityMissingCount: Number(
      extras.identityMissingCount ??
        base.missingIdentityCount ??
        byReason[PAIRING_CANDIDATE_REASON_CODES.MISSING_IDENTITY_LINK] ??
        0
    ),
    WRONG_SCOPE: Number(
      base.wrongScopeCount ?? byReason[PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE] ?? 0
    ),
    MEMBERSHIP_INACTIVE: Number(
      base.membershipInactiveCount ??
        byReason[PAIRING_CANDIDATE_REASON_CODES.MEMBERSHIP_INACTIVE] ??
        0
    ),
    MISSING_MEMBERSHIP: Number(
      byReason[PAIRING_CANDIDATE_REASON_CODES.MISSING_MEMBERSHIP] ?? 0
    ),
    MISSING_IDENTITY_LINK: Number(
      base.missingIdentityCount ??
        byReason[PAIRING_CANDIDATE_REASON_CODES.MISSING_IDENTITY_LINK] ??
        0
    ),
    ALREADY_ASSIGNED: Number(extras.alreadyAssignedCount || 0),
    GENDER_FILTERED: Number(extras.genderFilteredCount || 0),
    poolVersion: TEAM_TOURNAMENT_ATHLETE_POOL_VERSION,
    callerName: extras.callerName || null,
    scopeMode: extras.scopeMode || null,
    effectiveClubId: extras.effectiveClubId || null,
    effectiveTenantId: extras.effectiveTenantId || null,
    tournamentId: extras.tournamentId || null,
  };
}

function formatEmptyMessage(diagnostics) {
  const d = diagnostics || {};
  return (
    `Không có VĐV phù hợp ` +
    `(sourceCount=${d.sourceCount ?? 0}, ` +
    `membershipCount=${d.membershipCount ?? 0}, ` +
    `activeMembershipCount=${d.activeMembershipCount ?? 0}, ` +
    `identityMappedCount=${d.identityMappedCount ?? 0}, ` +
    `identityMissingCount=${d.identityMissingCount ?? 0}, ` +
    `eligibleCount=${d.eligibleCount ?? 0}, ` +
    `WRONG_SCOPE=${d.WRONG_SCOPE ?? 0}, ` +
    `MEMBERSHIP_INACTIVE=${d.MEMBERSHIP_INACTIVE ?? 0}, ` +
    `MISSING_MEMBERSHIP=${d.MISSING_MEMBERSHIP ?? 0}, ` +
    `MISSING_IDENTITY_LINK=${d.MISSING_IDENTITY_LINK ?? 0}, ` +
    `ALREADY_ASSIGNED=${d.ALREADY_ASSIGNED ?? 0}, ` +
    `GENDER_FILTERED=${d.GENDER_FILTERED ?? 0}).`
  );
}

/**
 * Apply post-discovery filters in locked order (after gateway eligibility).
 * Soft rules never remove athletes here.
 *
 * @param {object[]} athletes
 * @param {{ gender?: string|null, assignedAthleteIds?: string[] }} options
 */
export function applyTeamTournamentAthletePostFilters(athletes = [], options = {}) {
  const assigned = new Set(
    (options.assignedAthleteIds || []).map((id) => normalizeId(id)).filter(Boolean)
  );
  const gender = String(options.gender || "all").trim().toLowerCase();
  let alreadyAssignedCount = 0;
  let genderFilteredCount = 0;
  const out = [];

  for (const athlete of athletes || []) {
    const id = athleteKey(athlete);
    if (!id) continue;

    if (assigned.has(id)) {
      alreadyAssignedCount += 1;
      continue;
    }

    if (gender === "male" || gender === "female") {
      const g = getPlayerGenderKey(athlete);
      if (g && g !== gender) {
        genderFilteredCount += 1;
        continue;
      }
      if (!g) {
        genderFilteredCount += 1;
        continue;
      }
    }

    out.push(athlete);
  }

  return { athletes: out, alreadyAssignedCount, genderFilteredCount };
}

/**
 * Canonical Team Tournament athlete pool entry.
 *
 * @param {{
 *   tournamentId?: string|null,
 *   clubId?: string|null,
 *   tenantId?: string|null,
 *   scopeMode?: 'club'|'tenant',
 *   gender?: string|null,
 *   assignedAthleteIds?: string[],
 *   callerName?: string,
 *   deps?: object,
 * }} input
 */
export async function listAvailableAthletes(input = {}) {
  const scopeMode =
    input.scopeMode === TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT
      ? TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT
      : TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB;
  const clubId = normalizeId(input.clubId);
  const tenantId = isPlaceholderTenantId(input.tenantId)
    ? null
    : normalizeId(input.tenantId) || null;
  const tournamentId = normalizeId(input.tournamentId) || null;
  const callerName = String(input.callerName || "unknown").trim() || "unknown";
  const deps = input.deps || {};

  const meta = {
    callerName,
    scopeMode,
    effectiveClubId: clubId || null,
    effectiveTenantId: tenantId,
    tournamentId,
  };

  let poolResult;
  if (scopeMode === TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT) {
    if (!tenantId) {
      const diagnostics = enrichDiagnostics(null, {
        ...meta,
        identityMappedCount: 0,
        identityMissingCount: 0,
      });
      return {
        ok: false,
        code: PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE,
        message:
          "Chưa có tenant hợp lệ cho phạm vi Toàn bộ CLB (không dùng default-tenant).",
        athletes: [],
        players: [],
        diagnostics,
        emptyMessage: formatEmptyMessage(diagnostics),
      };
    }
    poolResult = await loadTenantPairingCandidatePool(tenantId, deps);
  } else {
    if (!clubId) {
      const diagnostics = enrichDiagnostics(null, meta);
      return {
        ok: false,
        code: PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE,
        message: "Chưa chọn CLB để tải danh sách VĐV.",
        athletes: [],
        players: [],
        diagnostics,
        emptyMessage: formatEmptyMessage(diagnostics),
      };
    }
    poolResult = await loadClubPairingCandidatePool(clubId, {
      ...deps,
      tenantId,
    });
  }

  if (!poolResult?.ok) {
    const diagnostics = enrichDiagnostics(poolResult?.diagnostics, {
      ...meta,
      byReason: poolResult?.gatewayResult?.summary?.byReason,
    });
    return {
      ok: false,
      code: poolResult?.code || "REPOSITORY_ERROR",
      message:
        poolResult?.message ||
        "Không tải được danh sách VĐV canonical. Không dùng roster blob.",
      athletes: [],
      players: [],
      diagnostics,
      emptyMessage: formatEmptyMessage(diagnostics),
      gatewayResult: poolResult?.gatewayResult || null,
    };
  }

  const gatewayDiagnostics =
    poolResult.diagnostics ||
    buildCandidateDiagnosticCounts(poolResult.gatewayResult);

  const identityMappedCount = (poolResult.players || []).filter(
    (p) => normalizeId(p.athleteId || p.pairingIdentityId || p.id)
  ).length;
  const byReason = poolResult.gatewayResult?.summary?.byReason || {};

  const filtered = applyTeamTournamentAthletePostFilters(poolResult.players || [], {
    gender: input.gender,
    assignedAthleteIds: input.assignedAthleteIds,
  });

  const diagnostics = enrichDiagnostics(gatewayDiagnostics, {
    ...meta,
    byReason,
    identityMappedCount,
    identityMissingCount:
      gatewayDiagnostics.missingIdentityCount ??
      byReason[PAIRING_CANDIDATE_REASON_CODES.MISSING_IDENTITY_LINK] ??
      0,
    alreadyAssignedCount: filtered.alreadyAssignedCount,
    genderFilteredCount: filtered.genderFilteredCount,
  });
  diagnostics.eligibleCount = filtered.athletes.length;

  const empty = filtered.athletes.length === 0;
  return {
    ok: true,
    empty,
    code: empty ? "NO_ELIGIBLE_CANDIDATES" : undefined,
    athletes: filtered.athletes,
    players: filtered.athletes,
    diagnostics,
    emptyMessage: empty ? formatEmptyMessage(diagnostics) : null,
    message: empty ? formatEmptyMessage(diagnostics) : undefined,
    gatewayResult: poolResult.gatewayResult || null,
  };
}

/**
 * Convenience: club-scoped host pool (manual add default / AI host scope).
 */
export function listClubAvailableAthletes(clubId, options = {}) {
  return listAvailableAthletes({
    ...options,
    clubId,
    scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
  });
}

/**
 * Convenience: tenant-wide “Toàn bộ CLB” pool.
 */
export function listTenantAvailableAthletes(tenantId, options = {}) {
  return listAvailableAthletes({
    ...options,
    tenantId,
    scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT,
  });
}

/**
 * Mutation helper — resolve club athletes via the same SSOT (never blob roster).
 *
 * @param {string} clubId
 * @param {{
 *   tenantId?: string|null,
 *   tournamentId?: string|null,
 *   callerName?: string,
 *   deps?: object,
 * }} [options]
 */
export async function loadAthletesForTeamTournamentMutation(clubId, options = {}) {
  const result = await listAvailableAthletes({
    clubId,
    tenantId: options.tenantId || null,
    tournamentId: options.tournamentId || null,
    scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
    callerName: options.callerName || "teamTournamentService.mutation",
    deps: options.deps,
  });
  if (!result.ok) {
    return {
      ok: false,
      athletes: [],
      players: [],
      code: result.code,
      error: result.message || "Không tải được VĐV canonical.",
      diagnostics: result.diagnostics || null,
    };
  }
  return {
    ok: true,
    athletes: result.athletes,
    players: result.athletes,
    diagnostics: result.diagnostics || null,
  };
}

/**
 * Match athletes.id (primary) or alias fields.
 * @param {object[]} athletes
 * @param {string} athleteId
 */
export function findAthleteInPool(athletes = [], athleteId) {
  const id = normalizeId(athleteId);
  if (!id) return null;
  return (
    (athletes || []).find((row) => {
      if (!row) return false;
      return (
        normalizeId(row.id) === id ||
        normalizeId(row.athleteId) === id ||
        normalizeId(row.pairingIdentityId) === id
      );
    }) || null
  );
}

/**
 * Canonical display name; missing identity is explicit (never silent blob fallback).
 * @param {object[]} athletes
 * @param {string} athleteId
 */
export function resolveAthleteDisplayName(athletes = [], athleteId) {
  const id = normalizeId(athleteId);
  if (!id) return "—";
  const athlete = findAthleteInPool(athletes, id);
  if (!athlete) {
    return `${id} (thiếu identity)`;
  }
  const name = String(athlete.name || athlete.displayName || "").trim();
  if (!name) {
    return `${id} (thiếu tên)`;
  }
  return name;
}
