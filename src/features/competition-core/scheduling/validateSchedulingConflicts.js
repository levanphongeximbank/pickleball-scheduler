import {
  ASSIGNMENT_STATUS,
  BYE_PARTICIPANT_ID,
  CONFLICT_SEVERITY,
  CONFLICT_TYPE,
  HARD_CONFLICT_TYPES,
  PENDING_LOSER_PREFIX,
  PENDING_WINNER_PREFIX,
} from "./schedulingConstants.js";
import { createSchedulingConflict } from "./schedulingContracts.js";

/**
 * @param {string} participantId
 */
export function isByeParticipant(participantId) {
  return String(participantId || "") === BYE_PARTICIPANT_ID;
}

/**
 * @param {string} participantId
 */
export function isPendingDependencyParticipant(participantId) {
  const key = String(participantId || "");
  return (
    key.startsWith(PENDING_WINNER_PREFIX) ||
    key.startsWith(PENDING_LOSER_PREFIX) ||
    key.startsWith("TBD") ||
    key.startsWith("tbd") ||
    key.includes("PENDING")
  );
}

/**
 * @param {import('./schedulingTypes.js').SchedulingResult} result
 * @param {import('./schedulingTypes.js').SchedulingRequest} [request]
 */
export function validateSchedulingConflicts(result, request = {}) {
  const conflicts = [];
  const warnings = [];
  const assignments = result.assignments || [];
  const matches = result.matches || [];
  const knownParticipants = new Set(
    (request.participants || []).map((item) => String(item.participantId)).filter(Boolean)
  );
  matches.forEach((match) => {
    if (match.entryAId) knownParticipants.add(String(match.entryAId));
    if (match.entryBId) knownParticipants.add(String(match.entryBId));
  });

  const assignmentByMatch = new Map();
  const courtSlotMap = new Map();
  const participantSlotMap = new Map();
  const refereeSlotMap = new Map();

  assignments.forEach((assignment) => {
    const matchId = String(assignment.matchId || "");
    if (matchId && assignmentByMatch.has(matchId)) {
      conflicts.push(
        createSchedulingConflict({
          type: CONFLICT_TYPE.DUPLICATE_MATCH_ASSIGNMENT,
          severity: CONFLICT_SEVERITY.HARD,
          matchIds: [matchId],
          message: `Duplicate assignment for match ${matchId}`,
          reasonCode: "duplicate_match_assignment",
        })
      );
    }
    if (matchId) {
      assignmentByMatch.set(matchId, assignment);
    }

    if (assignment.status === ASSIGNMENT_STATUS.BYE && (assignment.courtId || assignment.slotId)) {
      conflicts.push(
        createSchedulingConflict({
          type: CONFLICT_TYPE.INVALID_BYE_ASSIGNMENT,
          severity: CONFLICT_SEVERITY.HARD,
          matchIds: matchId ? [matchId] : [],
          message: "BYE assignment must not consume court or slot",
          reasonCode: "bye_consumes_resource",
        })
      );
    }

    const courtKey = `${assignment.courtId || ""}::${assignment.slotId || assignment.startTime || ""}`;
    if (assignment.courtId && (assignment.slotId || assignment.startTime)) {
      if (courtSlotMap.has(courtKey)) {
        conflicts.push(
          createSchedulingConflict({
            type: CONFLICT_TYPE.COURT_TIME_CONFLICT,
            severity: CONFLICT_SEVERITY.HARD,
            matchIds: [matchId, courtSlotMap.get(courtKey)].filter(Boolean),
            courtIds: [String(assignment.courtId)],
            slotIds: assignment.slotId ? [String(assignment.slotId)] : [],
            message: "Court double-booked at same slot/time",
            reasonCode: "court_time_conflict",
          })
        );
      } else {
        courtSlotMap.set(courtKey, matchId);
      }
    }

    if (assignment.refereeId && (assignment.slotId || assignment.startTime)) {
      const refKey = `${assignment.refereeId}::${assignment.slotId || assignment.startTime}`;
      if (refereeSlotMap.has(refKey)) {
        conflicts.push(
          createSchedulingConflict({
            type: CONFLICT_TYPE.REFEREE_TIME_CONFLICT,
            severity: CONFLICT_SEVERITY.SOFT,
            matchIds: [matchId, refereeSlotMap.get(refKey)].filter(Boolean),
            message: "Referee double-booked",
            reasonCode: "referee_time_conflict",
          })
        );
      } else {
        refereeSlotMap.set(refKey, matchId);
      }
    }
  });

  matches.forEach((match) => {
    const matchId = String(match.matchId || "");
    const entryA = String(match.entryAId || "");
    const entryB = String(match.entryBId || "");

    if (isByeParticipant(entryA) || isByeParticipant(entryB)) {
      if (assignmentByMatch.get(matchId)?.courtId) {
        conflicts.push(
          createSchedulingConflict({
            type: CONFLICT_TYPE.INVALID_BYE_ASSIGNMENT,
            severity: CONFLICT_SEVERITY.HARD,
            matchIds: [matchId],
            message: "BYE match must not consume court",
            reasonCode: "bye_match_court",
          })
        );
      }
      return;
    }

    if (isPendingDependencyParticipant(entryA) || isPendingDependencyParticipant(entryB)) {
      warnings.push(`Match ${matchId} has pending bracket dependency`);
      return;
    }

    [entryA, entryB].forEach((participantId) => {
      if (!participantId) {
        return;
      }
      if (knownParticipants.size > 0 && !knownParticipants.has(participantId) && !isPendingDependencyParticipant(participantId)) {
        conflicts.push(
          createSchedulingConflict({
            type: CONFLICT_TYPE.UNKNOWN_PARTICIPANT,
            severity: CONFLICT_SEVERITY.HARD,
            matchIds: [matchId],
            participantIds: [participantId],
            message: `Unknown participant ${participantId}`,
            reasonCode: "unknown_participant",
          })
        );
      }
    });

    const assignment = assignmentByMatch.get(matchId);
    const isEffectivelyUnassigned =
      !assignment ||
      assignment.status === ASSIGNMENT_STATUS.UNASSIGNED ||
      (
        assignment.status !== ASSIGNMENT_STATUS.BYE &&
        assignment.status !== ASSIGNMENT_STATUS.CANCELLED &&
        !assignment.courtId &&
        !assignment.slotId &&
        !assignment.startTime
      );
    if (isEffectivelyUnassigned && match.status !== ASSIGNMENT_STATUS.CANCELLED) {
      conflicts.push(
        createSchedulingConflict({
          type: CONFLICT_TYPE.UNASSIGNED_MATCH,
          severity: CONFLICT_SEVERITY.SOFT,
          matchIds: [matchId],
          message: `Match ${matchId} has no assignment`,
          reasonCode: "unassigned_match",
        })
      );
    }

    if (assignment?.slotId || assignment?.startTime) {
      [entryA, entryB].forEach((participantId) => {
        if (!participantId || isPendingDependencyParticipant(participantId)) {
          return;
        }
        const slotKey = `${participantId}::${assignment.slotId || assignment.startTime}`;
        if (participantSlotMap.has(slotKey)) {
          conflicts.push(
            createSchedulingConflict({
              type: CONFLICT_TYPE.PLAYER_TIME_CONFLICT,
              severity: CONFLICT_SEVERITY.HARD,
              matchIds: [matchId, participantSlotMap.get(slotKey)].filter(Boolean),
              participantIds: [participantId],
              message: `Participant ${participantId} double-booked`,
              reasonCode: "participant_time_conflict",
            })
          );
        } else {
          participantSlotMap.set(slotKey, matchId);
        }
      });
    }
  });

  (request.manualOverrides || []).forEach((override) => {
    const matchId = String(override.matchId || "");
    const assignment = assignmentByMatch.get(matchId);
    if (!assignment || !override.locked) {
      return;
    }
    if (override.field === "courtId" && override.afterValue && assignment.courtId !== override.afterValue) {
      conflicts.push(
        createSchedulingConflict({
          type: CONFLICT_TYPE.MANUAL_OVERRIDE_CONFLICT,
          severity: CONFLICT_SEVERITY.SOFT,
          matchIds: [matchId],
          message: `Manual court override not reflected for ${matchId}`,
          reasonCode: "manual_override_conflict",
          metadata: { overrideId: override.overrideId },
        })
      );
    }
  });

  const hardConflicts = conflicts.filter((item) =>
    HARD_CONFLICT_TYPES.includes(item.type) || item.severity === CONFLICT_SEVERITY.HARD
  );

  return {
    conflicts,
    hardConflicts,
    warnings,
    ok: hardConflicts.length === 0,
  };
}

/**
 * @param {import('./schedulingTypes.js').SchedulingConflict[]} conflicts
 */
export function partitionResolvedConflicts(conflicts = []) {
  const unresolved = conflicts.filter(
    (item) => item.severity === CONFLICT_SEVERITY.HARD || HARD_CONFLICT_TYPES.includes(item.type)
  );
  const resolved = conflicts.filter((item) => !unresolved.includes(item));
  return { resolved, unresolved };
}
