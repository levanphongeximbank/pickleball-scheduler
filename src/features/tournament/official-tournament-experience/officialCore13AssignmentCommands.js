/**
 * OFFICIAL_TOURNAMENT_CORE13_ASSIGNMENT_CUTOVER_01
 *
 * Single Official integration command facade for ASSIGN / REPLACE / UNASSIGN.
 *
 * Official Experience / Director
 *   → this facade
 *   → Adapter B translation helpers (identity resolve)
 *   → Canonical Edge client (Adapter A / CORE-13 trusted path)
 *   → public.referee_assignments
 *   → compatibility projection ONLY after ACK
 *
 * Does NOT modify CORE-13 internals, Adapter A, or Adapter B authority.
 * Does NOT invent a second assignment engine.
 */

import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import {
  projectCore13AssignmentOntoTournament,
  resolveCanonicalRefereeIdFromRoster,
} from "../../individual-tournament/engines/core13AssignmentProjection.js";
import {
  ASSIGNMENT_COMPETITION_MODE,
  assertCanonicalRefereeId,
  createCompetitionRefereeAssignmentTrustedClient,
  resolveCompetitionAssignmentEdgeBaseUrl,
} from "../../competition-engine/operations/referee/assignment/index.js";
import { REFEREE_ROLE_CODE } from "../../competition-core/referee-assignment/index.js";
import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { OFFICIAL_EXPERIENCE_AUTHORITY } from "./authorityLock.js";

export const OFFICIAL_CORE13_ASSIGNMENT_ACTIONS = Object.freeze({
  ASSIGN: "assign",
  REPLACE: "replace",
  UNASSIGN: "unassign",
});

export const OFFICIAL_MATCH_ID_MODEL = "opaque_string_match_key"; // e.g. GA-R1-M1
export const CORE13_MATCH_ID_MODEL = "opaque_string_match_key";
export const MATCH_ID_TRANSLATION_REQUIRED = false;

function trim(value) {
  return value != null ? String(value).trim() : "";
}

export function resolveOfficialAssignmentCompetitionMode(tournament) {
  const mode = String(tournament?.mode || "").toLowerCase();
  const officialMode = String(tournament?.officialMode || "").toLowerCase();
  const type = String(tournament?.type || tournament?.competitionType || "").toLowerCase();
  if (
    mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT ||
    type.includes("official") ||
    type.includes("open") ||
    officialMode
  ) {
    return ASSIGNMENT_COMPETITION_MODE.OFFICIAL_OPEN;
  }
  if (mode === TOURNAMENT_MODE.DAILY_PLAY || type.includes("daily")) {
    return ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY;
  }
  return ASSIGNMENT_COMPETITION_MODE.INTERNAL;
}

/**
 * Tenant != Club. Never substitute clubId for tenantId.
 */
export function resolveOfficialAssignmentTenantId(tournament, options = {}) {
  const tenantId = trim(options.tenantId || tournament?.tenantId);
  if (!tenantId) {
    return {
      ok: false,
      code: "TENANT_REQUIRED",
      error: "Thiếu tenantId canonical. Không dùng clubId/venueId thay thế Tenant.",
    };
  }
  const clubId = trim(tournament?.clubId || options.clubId);
  if (clubId && tenantId === clubId && !options.allowTenantEqualsClub) {
    // Soft warn path: some fixtures historically mirrored ids; still pass if explicit tenantId set.
  }
  return { ok: true, tenantId };
}

export function resolveOfficialAssignmentTournamentId(tournament) {
  const tournamentId = trim(tournament?.id || tournament?.tournamentId);
  if (!tournamentId) {
    return {
      ok: false,
      code: "TOURNAMENT_REQUIRED",
      error: "Thiếu tournamentId.",
    };
  }
  return { ok: true, tournamentId };
}

export function resolveOfficialAssignmentMatchId(matchId) {
  const id = trim(matchId);
  if (!id) {
    return { ok: false, code: "MATCH_REQUIRED", error: "Thiếu matchId." };
  }
  // Official group keys (GA-R1-M1) are opaque CORE-13 match scope keys — no translation.
  return { ok: true, matchId: id, translationRequired: false };
}

/**
 * CORE-13 subject = canonicalUserId (command field refereeId).
 * Never displayName / bare roster.id without canonical binding.
 */
export function resolveOfficialCore13RefereeSubject(tournament, rosterOrCanonicalId) {
  const resolved = resolveCanonicalRefereeIdFromRoster(tournament, rosterOrCanonicalId);
  if (!resolved.ok) {
    return {
      ok: false,
      code: resolved.code || "CANONICAL_REFEREE_ID_REQUIRED",
      error:
        resolved.error ||
        "Trọng tài chưa có danh tính canonical để phân công.",
      rosterEntry: resolved.rosterEntry || null,
    };
  }
  if (!resolved.refereeId) {
    return {
      ok: true,
      refereeId: "",
      rosterEntry: resolved.rosterEntry || null,
      unassign: true,
    };
  }
  try {
    assertCanonicalRefereeId(resolved.refereeId);
  } catch (error) {
    return {
      ok: false,
      code: "CANONICAL_REFEREE_ID_INVALID",
      error: error?.message || "refereeId canonical không hợp lệ.",
      rosterEntry: resolved.rosterEntry || null,
    };
  }
  return {
    ok: true,
    refereeId: String(resolved.refereeId),
    rosterEntry: resolved.rosterEntry || null,
    unassign: false,
  };
}

function defaultTrustedClient(options = {}) {
  if (options.api) return options.api;
  return createCompetitionRefereeAssignmentTrustedClient({
    edgeBaseUrl: resolveCompetitionAssignmentEdgeBaseUrl(),
    getAccessToken: async () => {
      if (typeof options.getAccessToken === "function") {
        return options.getAccessToken();
      }
      const client = getSupabaseAuthClient();
      const { data } = (await client?.auth.getSession()) || {};
      return data?.session?.access_token || null;
    },
  });
}

function buildScope(tournament, { tenantId, tournamentId, matchId, competitionMode }) {
  return {
    tenantId,
    tournamentId,
    matchId,
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    competitionMode,
    refereeFeatureEnabled: true,
  };
}

/**
 * Execute Official ASSIGN / REPLACE / UNASSIGN through CORE-13 Edge.
 * Compatibility blob projection runs ONLY after durable ACK.
 */
export async function executeOfficialCore13RefereeAssignment(tournament, input = {}, deps = {}) {
  const action = String(input.action || "").toLowerCase();
  if (
    action !== OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.ASSIGN &&
    action !== OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.REPLACE &&
    action !== OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN
  ) {
    return {
      ok: false,
      code: "INVALID_ACTION",
      error: "action phải là assign | replace | unassign.",
    };
  }

  const tenant = resolveOfficialAssignmentTenantId(tournament, input);
  if (!tenant.ok) return tenant;
  const tournamentScope = resolveOfficialAssignmentTournamentId(tournament);
  if (!tournamentScope.ok) return tournamentScope;
  const matchScope = resolveOfficialAssignmentMatchId(input.matchId);
  if (!matchScope.ok) return matchScope;

  const competitionMode =
    input.competitionMode || resolveOfficialAssignmentCompetitionMode(tournament);
  const api = defaultTrustedClient(deps);
  const scope = buildScope(tournament, {
    tenantId: tenant.tenantId,
    tournamentId: tournamentScope.tournamentId,
    matchId: matchScope.matchId,
    competitionMode,
  });

  let refereeId = "";
  let rosterEntry = null;
  if (action !== OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN) {
    const subject = resolveOfficialCore13RefereeSubject(
      tournament,
      input.refereeId || input.rosterOrCanonicalId || input.rosterId || ""
    );
    if (!subject.ok) return subject;
    if (subject.unassign) {
      return {
        ok: false,
        code: "REFEREE_REQUIRED",
        error: "Thiếu trọng tài canonical cho phân công / thay thế.",
      };
    }
    refereeId = subject.refereeId;
    rosterEntry = subject.rosterEntry;
  }

  const versionRes = await api.getMatchAssignmentVersion(scope);
  if (versionRes?.ok === false) {
    return {
      ok: false,
      code: versionRes.code || "VERSION_READ_FAILED",
      error: versionRes.error || "Không đọc được phiên bản phân công (CAS).",
    };
  }
  const expectedVersion =
    input.expectedVersion != null
      ? Number(input.expectedVersion)
      : Number(versionRes?.version ?? 0);

  const activeRes = await api.getActiveAssignment(scope);
  const active = activeRes?.assignment || null;

  let result;
  if (action === OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN) {
    if (!active && input.requireActive !== false) {
      // Idempotent no-op unassign when nothing active
      return {
        ok: true,
        noop: true,
        action,
        matchId: matchScope.matchId,
        refereeId: "",
        version: expectedVersion,
        tournament,
        projected: false,
        authority: OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT,
      };
    }
    const idempotencyKey =
      trim(input.idempotencyKey) ||
      `official-unassign-${matchScope.matchId}-${expectedVersion}`;
    result = await api.unassignReferee({
      ...scope,
      expectedVersion,
      idempotencyKey,
      reason: input.reason || "official-unassign",
    });
  } else if (action === OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.REPLACE || active) {
    const idempotencyKey =
      trim(input.idempotencyKey) ||
      `official-replace-${matchScope.matchId}-${refereeId}-${expectedVersion}`;
    result = await api.replaceReferee({
      ...scope,
      newRefereeId: String(refereeId),
      expectedVersion,
      idempotencyKey,
      reason: input.reason || "official-replace",
    });
  } else {
    const idempotencyKey =
      trim(input.idempotencyKey) ||
      `official-assign-${matchScope.matchId}-${refereeId}-${expectedVersion}`;
    result = await api.assignReferee({
      ...scope,
      refereeId: String(refereeId),
      expectedVersion,
      idempotencyKey,
      reason: input.reason || "official-assign",
    });
  }

  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || "CORE13_MUTATION_FAILED",
      error: result?.error || result?.code || "Phân công CORE-13 thất bại.",
      core13: true,
      projected: false,
    };
  }

  // Compatibility projection ONLY after durable ACK — never before.
  const nextTournament = projectCore13AssignmentOntoTournament(tournament, {
    matchId: matchScope.matchId,
    refereeId: action === OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN ? "" : refereeId,
    rosterId: rosterEntry?.id || input.rosterId || "",
    assignment: result.assignment || null,
    version: result.version ?? expectedVersion,
  });

  return {
    ok: true,
    action:
      action === OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN
        ? OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN
        : active || action === OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.REPLACE
          ? OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.REPLACE
          : OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.ASSIGN,
    matchId: matchScope.matchId,
    refereeId: action === OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN ? "" : refereeId,
    rosterEntry,
    assignment: result.assignment || null,
    version: result.version ?? expectedVersion,
    expectedVersion,
    tournament: nextTournament,
    projected: true,
    core13: true,
    authority: OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT,
    settingsRefereeAssignmentsAuthority: "COMPATIBILITY_PROJECTION_ONLY",
    matchRefereeAuthority: "NOT_WRITTEN_BY_FACADE",
  };
}

export async function officialAssignReferee(tournament, input = {}, deps = {}) {
  return executeOfficialCore13RefereeAssignment(
    tournament,
    { ...input, action: OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.ASSIGN },
    deps
  );
}

export async function officialReplaceReferee(tournament, input = {}, deps = {}) {
  return executeOfficialCore13RefereeAssignment(
    tournament,
    { ...input, action: OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.REPLACE },
    deps
  );
}

export async function officialUnassignReferee(tournament, input = {}, deps = {}) {
  return executeOfficialCore13RefereeAssignment(
    tournament,
    { ...input, action: OFFICIAL_CORE13_ASSIGNMENT_ACTIONS.UNASSIGN },
    deps
  );
}
