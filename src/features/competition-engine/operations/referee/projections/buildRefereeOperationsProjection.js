/**
 * Referee-facing operational projection — aggregates assignment + lifecycle + validation.
 * Does not compute winners or standings.
 */

import {
  MATCH_STATUS,
} from "../../../../competition-core/matches/index.js";
import {
  REFEREE_ACTION,
  REFEREE_ASSIGNMENT_OPS_STATUS,
  REFEREE_BLOCKER_CODE,
  REFEREE_VALIDATION_OPS_STATUS,
} from "../constants.js";
import {
  computeOrganizerFingerprint,
  deepFreeze,
} from "../../fingerprint.js";
import {
  REFEREE_ACTION_PERMISSION_MAP,
  resolveRefereeActionPermissions,
} from "../permissions/refereeActionMap.js";
import { isActiveRefereeAssignmentStatus } from "../context/assertRefereeAssignment.js";

/**
 * @param {object} match
 * @param {object|null} session
 * @param {object|null} validation
 */
function collectDeniedReasons(match, session, validation, assignment) {
  /** @type {object[]} */
  const denied = [];
  if (!assignment || !isActiveRefereeAssignmentStatus(assignment.status)) {
    denied.push({
      action: "*",
      reasonCode: REFEREE_BLOCKER_CODE.NOT_ASSIGNED,
    });
  }
  const status = String(match?.status || "").toUpperCase();
  if (status !== MATCH_STATUS.IN_PROGRESS && status !== "ACTIVE") {
    denied.push({
      action: REFEREE_ACTION.SCORE_SUBMIT,
      reasonCode: REFEREE_BLOCKER_CODE.MATCH_NOT_ACTIVE,
      lifecycleStatus: status || null,
    });
  }
  if (!session) {
    denied.push({
      action: REFEREE_ACTION.SCORE_SUBMIT,
      reasonCode: REFEREE_BLOCKER_CODE.SCORE_ENTRY_NOT_READY,
    });
  }
  if (
    validation?.status === REFEREE_VALIDATION_OPS_STATUS.CORRECTION_REQUIRED
  ) {
    // correction path is allowed; score submit without correction flag denied elsewhere
  }
  return denied;
}

/**
 * @param {{
 *   record: object,
 *   refereeId: string,
 *   grantedPermissions?: Iterable<string>,
 *   matchId?: string|null,
 * }} input
 */
export function buildRefereeOperationsProjection(input) {
  const record = input.record || {};
  const refereeId = String(input.refereeId || "").trim();
  const grantedPermissions = new Set(
    Array.isArray(input.grantedPermissions)
      ? input.grantedPermissions
      : input.grantedPermissions
        ? [...input.grantedPermissions]
        : []
  );

  const assignments = (Array.isArray(record.assignments) ? record.assignments : [])
    .filter((a) => String(a?.refereeId || "").trim() === refereeId)
    .map((a) => deepFreeze({ ...a }));

  const focusMatchId = input.matchId
    ? String(input.matchId).trim()
    : assignments[0]?.matchId || null;

  const focusAssignment =
    assignments.find((a) => a.matchId === focusMatchId) || null;
  const match =
    focusMatchId && record.matches?.[focusMatchId]
      ? deepFreeze({ ...record.matches[focusMatchId] })
      : null;
  const session =
    focusMatchId && record.scoreSessions?.[focusMatchId]
      ? deepFreeze({ ...record.scoreSessions[focusMatchId] })
      : null;
  const validation =
    focusMatchId && record.validationByMatch?.[focusMatchId]
      ? deepFreeze({ ...record.validationByMatch[focusMatchId] })
      : deepFreeze({
          status: REFEREE_VALIDATION_OPS_STATUS.NONE,
          validatedResult: null,
          correctionRequiredCodes: [],
        });

  const deniedLifecycle = collectDeniedReasons(
    match,
    session,
    validation,
    focusAssignment
  );

  const allowed = [];
  const denied = [...deniedLifecycle];

  for (const action of Object.keys(REFEREE_ACTION_PERMISSION_MAP)) {
    const mapping = resolveRefereeActionPermissions(action);
    const hasPerm = mapping.requiredPermissions.some((p) =>
      grantedPermissions.has(p)
    );
    if (!hasPerm) {
      denied.push({
        action,
        capability: mapping.capability,
        reasonCode: REFEREE_BLOCKER_CODE.PERMISSION_DENIED,
        requiredPermissions: [...mapping.requiredPermissions],
      });
      continue;
    }
    if (
      !focusAssignment &&
      action !== REFEREE_ACTION.ASSIGNMENT_READ
    ) {
      denied.push({
        action,
        capability: mapping.capability,
        reasonCode: REFEREE_BLOCKER_CODE.NOT_ASSIGNED,
      });
      continue;
    }
    if (
      (action === REFEREE_ACTION.SCORE_SESSION ||
        action === REFEREE_ACTION.SCORE_SUBMIT) &&
      match &&
      String(match.status || "").toUpperCase() !== MATCH_STATUS.IN_PROGRESS
    ) {
      denied.push({
        action,
        capability: mapping.capability,
        reasonCode: REFEREE_BLOCKER_CODE.MATCH_NOT_ACTIVE,
      });
      continue;
    }
    if (
      action === REFEREE_ACTION.RESULT_CORRECT &&
      validation.status !== REFEREE_VALIDATION_OPS_STATUS.CORRECTION_REQUIRED
    ) {
      denied.push({
        action,
        capability: mapping.capability,
        reasonCode: REFEREE_BLOCKER_CODE.CORRECTION_NOT_REQUIRED,
      });
      continue;
    }
    allowed.push({ action, capability: mapping.capability });
  }

  const projection = {
    phase: "E2E-04",
    referee: Object.freeze({
      refereeId,
      assignmentCount: assignments.length,
    }),
    assignmentQueue: Object.freeze(
      assignments.map((a) =>
        deepFreeze({
          assignmentId: a.assignmentId,
          matchId: a.matchId,
          status: a.status || REFEREE_ASSIGNMENT_OPS_STATUS.ASSIGNED,
          venueId: a.venueId || record.venueId || null,
          courtId: a.courtId || null,
          scheduledAt: a.scheduledAt || null,
          participants: a.participants || [],
          entries: a.entries || [],
          checkInReady: a.checkInReady === true,
        })
      )
    ),
    assignedMatch: focusAssignment
      ? deepFreeze({
          assignment: focusAssignment,
          match,
          venueId: focusAssignment.venueId || record.venueId || null,
          courtId: focusAssignment.courtId || match?.courtAssignmentRef || null,
          scheduledAt: focusAssignment.scheduledAt || match?.scheduledAt || null,
          participants: focusAssignment.participants || [],
          entries: focusAssignment.entries || [],
          checkInReady: focusAssignment.checkInReady === true,
          lifecycleState: match?.status || null,
          scoreEntryReady:
            Boolean(session) &&
            String(match?.status || "").toUpperCase() ===
              MATCH_STATUS.IN_PROGRESS,
          scoreProjection: session?.projection || null,
          validationStatus: validation.status,
          correctionRequired:
            validation.status ===
            REFEREE_VALIDATION_OPS_STATUS.CORRECTION_REQUIRED,
          correctionRequiredCodes: validation.correctionRequiredCodes || [],
          validatedResult:
            validation.status === REFEREE_VALIDATION_OPS_STATUS.ACCEPTED
              ? validation.validatedResult
              : null,
          winnerInference: false,
        })
      : null,
    allowedActions: Object.freeze(allowed),
    deniedActions: Object.freeze(denied),
  };

  const projectionFingerprint = computeOrganizerFingerprint(
    {
      refereeId,
      assignmentIds: assignments.map((a) => a.assignmentId).sort(),
      matchId: focusMatchId,
      lifecycleState: match?.status || null,
      validationStatus: validation.status,
      allowedActions: allowed.map((a) => a.action).sort(),
      revision: record.revision || 0,
    },
    "e2e04-referee"
  );

  return deepFreeze({
    ...projection,
    projectionFingerprint,
  });
}
