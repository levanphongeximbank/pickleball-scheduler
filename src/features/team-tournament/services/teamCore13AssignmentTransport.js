/**
 * Team Tournament assignment transport.
 *
 * Preferred final write path: shared Competition assignment trusted server.
 * Team RPC may remain as non-authoritative compatibility transport.
 *
 * TEAM_RPC_MAY_REMAIN_AS_THIN_TRANSPORT=YES
 * TEAM_RPC_MAY_REMAIN_ASSIGNMENT_AUTHORITY=NO
 */

import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import {
  createCompetitionRefereeAssignmentTrustedClient,
  resolveCompetitionAssignmentEdgeBaseUrl,
} from "../../competition-engine/operations/referee/assignment/client/competitionRefereeAssignmentEdgeClient.js";
import { ASSIGNMENT_COMPETITION_MODE } from "../../competition-engine/operations/referee/assignment/constants.js";
import {
  rpcTeamTournamentCreateRefereeAssignment,
  rpcTeamTournamentRevokeRefereeAssignment,
} from "./teamTournamentRpcService.js";
import { buildCreateAssignmentPayload } from "../engines/teamRefereeV5SafetyEngine.js";

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
 * Compatibility Team RPC transport — not assignment authority.
 * Kept until callers are proven cut over.
 */
export async function assignTeamRefereeViaLegacyTeamRpcTransport(input = {}) {
  const existing = Array.isArray(input.existingAssignments)
    ? input.existingAssignments
    : [];
  const live = existing.filter((row) => {
    const status = String(row.effectiveStatus || row.status || "").toLowerCase();
    return status === "pending" || status === "active";
  });

  if (live.length > 0) {
    for (const row of live) {
      const revoke = await rpcTeamTournamentRevokeRefereeAssignment({
        assignmentId: row.id || row.assignmentId,
        expectedVersion: row.version,
        reason: input.reason || "CORE-13 atomic replace compatibility transport",
      });
      if (!revoke.ok && !revoke.replayed) {
        return {
          ok: false,
          code: revoke.code || "REVOKE_FAILED",
          error: revoke.error || "Replace transport revoke failed",
          revoke,
          transport: "team_tournament_create_referee_assignment",
          transportIsAuthority: false,
        };
      }
    }
  }

  const created = await rpcTeamTournamentCreateRefereeAssignment(
    buildCreateAssignmentPayload({
      tournamentId: input.tournamentId,
      matchupId: input.matchupId,
      subMatchId: input.subMatchId || null,
      refereeUserId: input.refereeUserId,
      activate: input.activate !== false,
      reason: input.reason || "CORE-13 team assign compatibility transport",
      idempotencyKey: input.idempotencyKey || null,
    })
  );

  return {
    ...created,
    assignmentAuthority: "CORE-13",
    transport: "team_tournament_create_referee_assignment",
    transportIsAuthority: false,
    authoritativeExecutionLocation: "COMPATIBILITY_ONLY",
  };
}

/**
 * Authoritative Team assign/replace via the shared Competition trusted server.
 */
export async function assignTeamRefereeViaCore13(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const matchId = String(input.matchId || "").trim();
  const refereeUserId = String(input.refereeUserId || "").trim();
  if (!tenantId || !tournamentId || !matchId || !refereeUserId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: "tenantId, tournamentId, matchId, refereeUserId required",
    };
  }

  if (input.forceLegacyTeamTransport === true) {
    return assignTeamRefereeViaLegacyTeamRpcTransport(input);
  }

  const existing = Array.isArray(input.existingAssignments)
    ? input.existingAssignments
    : [];
  const live = existing.filter((row) => {
    const status = String(row.effectiveStatus || row.status || "").toLowerCase();
    return status === "pending" || status === "active";
  });

  const api = createTrustedClient();
  const versionRes = await api.getMatchAssignmentVersion({
    tenantId,
    tournamentId,
    matchId,
    competitionMode: ASSIGNMENT_COMPETITION_MODE.TEAM,
  });
  if (versionRes?.ok === false) {
    return versionRes;
  }
  const version = Number(versionRes?.version ?? 0);
  const command = {
    tenantId,
    tournamentId,
    matchId,
    expectedVersion: version,
    competitionMode: ASSIGNMENT_COMPETITION_MODE.TEAM,
    reason: input.reason || "TEAM CORE-13 trusted server",
    idempotencyKey:
      input.idempotencyKey || `team-${tournamentId}-${matchId}-${refereeUserId}-${version}`,
  };

  if (live.length === 0) {
    const result = await api.assignReferee({
      ...command,
      refereeId: refereeUserId,
    });
    return {
      ...result,
      assignmentAuthority: "CORE-13",
      transport: "competition-referee-assignment",
      transportIsAuthority: false,
      authoritativeExecutionLocation: "TRUSTED_SERVER",
    };
  }

  const result = await api.replaceReferee({
    ...command,
    newRefereeId: refereeUserId,
    expectedVersion: Number(live[0]?.version ?? version),
  });
  return {
    ...result,
    assignmentAuthority: "CORE-13",
    transport: "competition-referee-assignment",
    transportIsAuthority: false,
    authoritativeExecutionLocation: "TRUSTED_SERVER",
  };
}

export async function unassignTeamRefereeViaCore13(input = {}) {
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
  if (input.forceLegacyTeamTransport === true) {
    return rpcTeamTournamentRevokeRefereeAssignment({
      assignmentId: input.assignmentId,
      expectedVersion: input.expectedVersion,
      reason: input.reason || "compatibility unassign",
    });
  }
  const api = createTrustedClient();
  const versionRes = await api.getMatchAssignmentVersion({
    tenantId,
    tournamentId,
    matchId,
    competitionMode: ASSIGNMENT_COMPETITION_MODE.TEAM,
  });
  if (versionRes?.ok === false) return versionRes;
  const result = await api.unassignReferee({
    tenantId,
    tournamentId,
    matchId,
    expectedVersion: Number(input.expectedVersion ?? versionRes?.version ?? 0),
    reason: input.reason || "TEAM CORE-13 unassign",
    competitionMode: ASSIGNMENT_COMPETITION_MODE.TEAM,
    idempotencyKey:
      input.idempotencyKey ||
      `team-unassign-${tournamentId}-${matchId}-${input.expectedVersion ?? versionRes?.version ?? 0}`,
  });
  return {
    ...result,
    assignmentAuthority: "CORE-13",
    transport: "competition-referee-assignment",
    transportIsAuthority: false,
    authoritativeExecutionLocation: "TRUSTED_SERVER",
  };
}
