/**
 * Team Tournament assignment transport — thin RPC after CORE-13 decision.
 *
 * TEAM_RPC_MAY_REMAIN_AS_THIN_TRANSPORT=YES
 * TEAM_RPC_MAY_REMAIN_ASSIGNMENT_AUTHORITY=NO
 *
 * Prefer competition_* RPCs once Owner applies
 * docs/v5/migrations/core13-canonical-assignment-runtime-closure-01/.
 */

import {
  createRefereeCandidate,
  createManualRefereeAssignmentRequest,
  createRefereeReplacementRequest,
  createRefereeAssignment,
  createMatchScheduleRow,
  validateManualRefereeAssignment,
  replaceRefereeAssignment,
  REFEREE_ROLE_CODE,
  REFEREE_ASSIGNMENT_STATUS,
  REFEREE_ASSIGNMENT_SOURCE,
} from "../../competition-core/referee-assignment/index.js";
import {
  createPopulatedSnapshotResult,
  createEmptySnapshotResult,
} from "../../competition-core/referee-assignment/ports/portResult.js";
import {
  rpcTeamTournamentCreateRefereeAssignment,
  rpcTeamTournamentRevokeRefereeAssignment,
} from "./teamTournamentRpcService.js";
import { buildCreateAssignmentPayload } from "../engines/teamRefereeV5SafetyEngine.js";

function toCore13Existing(rows = []) {
  return createPopulatedSnapshotResult(
    (rows || [])
      .filter((row) => {
        const status = String(row.effectiveStatus || row.status || "").toLowerCase();
        return status === "pending" || status === "active";
      })
      .map((row) =>
        createRefereeAssignment({
          assignmentId: String(row.id || row.assignmentId),
          matchId: String(
            row.matchId ||
              row.assignmentMatchId ||
              row.externalSubMatchId ||
              row.matchupId ||
              ""
          ),
          refereeId: String(row.refereeUserId || row.refereeId || ""),
          roleCode: REFEREE_ROLE_CODE.PRIMARY,
          status: REFEREE_ASSIGNMENT_STATUS.CONFIRMED,
          source: REFEREE_ASSIGNMENT_SOURCE.MANUAL,
          constraintsSatisfied: [],
        })
      )
  );
}

/**
 * @param {object} input
 */
export async function assignTeamRefereeViaCore13(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const matchId = String(input.matchId || "").trim();
  const refereeUserId = String(input.refereeUserId || "").trim();
  const actorId = String(input.actorId || input.actor?.id || "team-organizer");
  if (!tenantId || !tournamentId || !matchId || !refereeUserId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: "tenantId, tournamentId, matchId, refereeUserId required",
    };
  }

  const existing = Array.isArray(input.existingAssignments)
    ? input.existingAssignments
    : [];
  const live = existing.filter((row) => {
    const status = String(row.effectiveStatus || row.status || "").toLowerCase();
    return status === "pending" || status === "active";
  });

  const directorySnapshot = createPopulatedSnapshotResult([
    createRefereeCandidate({
      refereeId: refereeUserId,
      active: true,
      userId: refereeUserId,
      displayLabel: input.displayLabel,
    }),
  ]);
  const scheduleSnapshot = createPopulatedSnapshotResult([
    createMatchScheduleRow({
      matchId,
      startAt: input.startAt || "2026-08-17T10:00:00.000Z",
      endAt: input.endAt || "2026-08-17T11:00:00.000Z",
    }),
  ]);

  if (live.length === 0) {
    const core13 = validateManualRefereeAssignment({
      request: createManualRefereeAssignmentRequest({
        requestId: input.idempotencyKey || `team-assign-${matchId}-${refereeUserId}`,
        tenantId,
        tournamentId,
        matchId,
        refereeId: refereeUserId,
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        actorRef: actorId,
        allowSoftOverride: true,
      }),
      directorySnapshot,
      scheduleSnapshot,
      existingAssignmentSnapshot: toCore13Existing(existing),
      qualificationSnapshot: createEmptySnapshotResult(),
      availabilitySnapshot: createEmptySnapshotResult(),
      requireQualificationSnapshot: false,
      requireAvailabilitySnapshot: false,
    });
    if (!core13.ok || !core13.accepted) {
      return {
        ok: false,
        code: "CORE13_VALIDATION_REJECTED",
        error: core13.failure?.message || "CORE-13 rejected assign",
        core13,
      };
    }
  } else {
    const prior = live[0];
    const core13 = replaceRefereeAssignment({
      request: createRefereeReplacementRequest({
        requestId:
          input.idempotencyKey || `team-replace-${matchId}-${refereeUserId}`,
        tenantId,
        tournamentId,
        matchId,
        assignmentId: String(prior.id || prior.assignmentId),
        outgoingRefereeId: String(prior.refereeUserId || prior.refereeId),
        incomingRefereeId: refereeUserId,
        roleCode: REFEREE_ROLE_CODE.PRIMARY,
        actorRef: actorId,
        allowSoftOverride: true,
        reasonCode: input.reason || "TEAM_REPLACE",
      }),
      directorySnapshot,
      scheduleSnapshot,
      existingAssignmentSnapshot: toCore13Existing(existing),
      qualificationSnapshot: createEmptySnapshotResult(),
      availabilitySnapshot: createEmptySnapshotResult(),
    });
    if (!core13.ok || !core13.accepted) {
      return {
        ok: false,
        code: "CORE13_VALIDATION_REJECTED",
        error: core13.failure?.message || "CORE-13 rejected replace",
        core13,
      };
    }
    // Transport shim until competition_replace_referee SQL is applied:
    // revoke then create inside this single command boundary (not a second authority).
    for (const row of live) {
      const revoke = await rpcTeamTournamentRevokeRefereeAssignment({
        assignmentId: row.id || row.assignmentId,
        expectedVersion: row.version,
        reason: input.reason || "CORE-13 atomic replace transport",
      });
      if (!revoke.ok && !revoke.replayed) {
        return {
          ok: false,
          code: revoke.code || "REVOKE_FAILED",
          error: revoke.error || "Replace transport revoke failed",
          revoke,
        };
      }
    }
  }

  const created = await rpcTeamTournamentCreateRefereeAssignment(
    buildCreateAssignmentPayload({
      tournamentId,
      matchupId: input.matchupId,
      subMatchId: input.subMatchId || null,
      refereeUserId,
      activate: input.activate !== false,
      reason: input.reason || "CORE-13 team assign transport",
      idempotencyKey: input.idempotencyKey || null,
    })
  );

  return {
    ...created,
    core13Decision: "ACCEPT",
    assignmentAuthority: "CORE-13",
    transport: "team_tournament_create_referee_assignment",
    transportIsAuthority: false,
  };
}
