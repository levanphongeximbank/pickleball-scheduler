/**
 * Daily Director → CORE-13 assignment transport.
 *
 * dailyRefereeAssignments remains projection/display only (non-authoritative).
 * DAILY_WRITER_AS_ASSIGNMENT_AUTHORITY=DENY
 */

import { getSupabaseAuthClient } from "../../../../auth/supabaseClient.js";
import {
  ASSIGNMENT_COMPETITION_MODE,
  assertCanonicalRefereeId,
  createCompetitionRefereeAssignmentTrustedClient,
  resolveCompetitionAssignmentEdgeBaseUrl,
} from "../../../competition-engine/operations/referee/assignment/index.js";
import { REFEREE_ROLE_CODE } from "../../../competition-core/referee-assignment/index.js";

function createTrustedClient() {
  return createCompetitionRefereeAssignmentTrustedClient({
    edgeBaseUrl: resolveCompetitionAssignmentEdgeBaseUrl(),
    getAccessToken: async () => {
      const client = getSupabaseAuthClient();
      const { data } = (await client?.auth.getSession()) || {};
      return data?.session?.access_token || null;
    },
  });
}

/**
 * Authoritative Daily assign/replace via shared Competition trusted server.
 * @param {{
 *   tenantId: string,
 *   tournamentId: string,
 *   matchId: string,
 *   refereeUserId: string,
 *   idempotencyKey?: string,
 *   reason?: string,
 * }} input
 */
export async function assignDailyRefereeViaCore13(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const matchId = String(input.matchId || "").trim();
  let refereeUserId = String(input.refereeUserId || "").trim();
  if (!tenantId || !tournamentId || !matchId || !refereeUserId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error:
        "Daily CORE-13 assign requires tenantId, tournamentId, matchId, and canonical refereeUserId",
    };
  }
  try {
    refereeUserId = assertCanonicalRefereeId(refereeUserId);
  } catch (err) {
    return {
      ok: false,
      code: err?.code || "CANONICAL_REFEREE_REQUIRED",
      error:
        err?.message ||
        "Daily assignment requires a canonical referee UUID (CORE-13)",
    };
  }

  const api = createTrustedClient();
  const base = {
    tenantId,
    tournamentId,
    matchId,
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
    refereeFeatureEnabled: true,
  };
  const versionRes = await api.getMatchAssignmentVersion(base);
  if (versionRes?.ok === false) return versionRes;
  const version = Number(versionRes?.version ?? 0);
  const activeRes = await api.getActiveAssignment(base);
  const active = activeRes?.assignment || null;

  if (active) {
    const result = await api.replaceReferee({
      ...base,
      newRefereeId: refereeUserId,
      expectedVersion: version,
      idempotencyKey:
        input.idempotencyKey ||
        `daily-replace-${matchId}-${refereeUserId}-${version}`,
      reason: input.reason || "daily-director-replace",
    });
    return {
      ...result,
      assignmentAuthority: "CORE-13",
      transport: "competition-referee-assignment",
      transportIsAuthority: false,
      dailyWriterAsAssignmentAuthority: "DENY",
    };
  }

  const result = await api.assignReferee({
    ...base,
    refereeId: refereeUserId,
    expectedVersion: version,
    idempotencyKey:
      input.idempotencyKey ||
      `daily-assign-${matchId}-${refereeUserId}-${version}`,
    reason: input.reason || "daily-director-assign",
  });
  return {
    ...result,
    assignmentAuthority: "CORE-13",
    transport: "competition-referee-assignment",
    transportIsAuthority: false,
    dailyWriterAsAssignmentAuthority: "DENY",
  };
}

/**
 * Authoritative Daily unassign via shared Competition trusted server.
 */
export async function unassignDailyRefereeViaCore13(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const matchId = String(input.matchId || "").trim();
  if (!tenantId || !tournamentId || !matchId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: "tenantId, tournamentId, matchId required",
    };
  }
  const api = createTrustedClient();
  const base = {
    tenantId,
    tournamentId,
    matchId,
    roleCode: REFEREE_ROLE_CODE.PRIMARY,
    competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
    refereeFeatureEnabled: true,
  };
  const versionRes = await api.getMatchAssignmentVersion(base);
  if (versionRes?.ok === false) return versionRes;
  const version = Number(versionRes?.version ?? 0);
  const result = await api.unassignReferee({
    ...base,
    expectedVersion: version,
    idempotencyKey:
      input.idempotencyKey || `daily-unassign-${matchId}-${version}`,
    reason: input.reason || "daily-director-unassign",
  });
  return {
    ...result,
    assignmentAuthority: "CORE-13",
    transport: "competition-referee-assignment",
    transportIsAuthority: false,
    dailyWriterAsAssignmentAuthority: "DENY",
  };
}

/**
 * Build non-authoritative Daily display projection after CORE-13 success.
 */
export function buildDailyCore13AssignmentProjection(matchId, referee, core13Result) {
  if (!matchId) return null;
  return {
    dailyRefereeAssignments: {
      [String(matchId)]: {
        ...(referee || {}),
        authority: false,
        projectionOnly: true,
        source: "core13-trusted-server-projection",
        assignmentAuthority: "CORE-13",
        assignmentId: core13Result?.assignmentId || core13Result?.assignment?.id || null,
        // Token/live link is not assignment authority after CORE-13 cutover.
        token: null,
      },
    },
  };
}
