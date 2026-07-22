/**
 * CORE-12 — CourtConstraint / LockedCourtAssignment / result fragment factories.
 */

import {
  CONFLICT_SEVERITY,
  CONFLICT_SEVERITY_VALUES,
  COURT_ASSIGNMENT_SOURCE,
  COURT_ASSIGNMENT_SOURCE_VALUES,
  COURT_CONSTRAINT_KIND,
  COURT_CONSTRAINT_KIND_VALUES,
  COURT_LOCK_SOURCE,
  COURT_LOCK_SOURCE_VALUES,
} from "../enums/index.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireBoolean,
  requireEnum,
  requireStableId,
} from "./shared.js";

const CONSTRAINT_ALLOWED = Object.freeze([
  "constraintId",
  "kind",
  "code",
  "matchId",
  "courtId",
  "params",
  "message",
]);

/**
 * @param {object} [partial]
 */
export function createCourtConstraint(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    CONSTRAINT_ALLOWED,
    "CourtConstraint"
  );
  return Object.freeze({
    constraintId: requireStableId(
      partial.constraintId,
      "CourtConstraint.constraintId"
    ),
    kind: requireEnum(
      partial.kind,
      COURT_CONSTRAINT_KIND_VALUES,
      "CourtConstraint.kind"
    ),
    code: requireStableId(partial.code, "CourtConstraint.code"),
    matchId:
      partial.matchId == null
        ? null
        : requireStableId(partial.matchId, "CourtConstraint.matchId"),
    courtId:
      partial.courtId == null
        ? null
        : requireStableId(partial.courtId, "CourtConstraint.courtId"),
    params: cloneFreezeObject(partial.params, "CourtConstraint.params"),
    message:
      partial.message == null
        ? null
        : String(partial.message),
  });
}

const LOCK_ALLOWED = Object.freeze([
  "matchId",
  "courtId",
  "lockSource",
  "reason",
  "overrideAllowed",
]);

/**
 * @param {object} [partial]
 */
export function createLockedCourtAssignment(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    LOCK_ALLOWED,
    "LockedCourtAssignment"
  );
  return Object.freeze({
    matchId: requireStableId(
      partial.matchId,
      "LockedCourtAssignment.matchId"
    ),
    courtId: requireStableId(
      partial.courtId,
      "LockedCourtAssignment.courtId"
    ),
    lockSource: requireEnum(
      partial.lockSource ?? COURT_LOCK_SOURCE.MANUAL,
      COURT_LOCK_SOURCE_VALUES,
      "LockedCourtAssignment.lockSource"
    ),
    reason: partial.reason == null ? null : String(partial.reason),
    overrideAllowed: requireBoolean(
      partial.overrideAllowed ?? false,
      "LockedCourtAssignment.overrideAllowed"
    ),
  });
}

const SLOT_ALLOWED = Object.freeze([
  "matchId",
  "courtId",
  "venueId",
  "scheduledStart",
  "scheduledEnd",
  "assignmentSource",
  "reasonCode",
  "reason",
  "importance",
]);

/**
 * @param {object} [partial]
 */
export function createAssignedCourtSlot(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    SLOT_ALLOWED,
    "AssignedCourtSlot"
  );
  return Object.freeze({
    matchId: requireStableId(partial.matchId, "AssignedCourtSlot.matchId"),
    courtId: requireStableId(partial.courtId, "AssignedCourtSlot.courtId"),
    venueId: requireStableId(partial.venueId, "AssignedCourtSlot.venueId"),
    scheduledStart: requireStableId(
      partial.scheduledStart,
      "AssignedCourtSlot.scheduledStart"
    ),
    scheduledEnd: requireStableId(
      partial.scheduledEnd,
      "AssignedCourtSlot.scheduledEnd"
    ),
    assignmentSource: requireEnum(
      partial.assignmentSource,
      COURT_ASSIGNMENT_SOURCE_VALUES,
      "AssignedCourtSlot.assignmentSource"
    ),
    reasonCode: requireStableId(
      partial.reasonCode,
      "AssignedCourtSlot.reasonCode"
    ),
    reason: partial.reason == null ? null : String(partial.reason),
    importance:
      partial.importance == null ? null : Number(partial.importance),
  });
}

const UNASSIGNED_ALLOWED = Object.freeze([
  "matchId",
  "reasonCode",
  "message",
  "attemptedCourtIds",
  "blockingConflictIds",
]);

/**
 * @param {object} [partial]
 */
export function createUnassignedMatch(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    UNASSIGNED_ALLOWED,
    "UnassignedMatch"
  );
  const attempted = Array.isArray(partial.attemptedCourtIds)
    ? partial.attemptedCourtIds.map((id) => String(id))
    : [];
  const blocking = Array.isArray(partial.blockingConflictIds)
    ? partial.blockingConflictIds.map((id) => String(id))
    : [];
  return Object.freeze({
    matchId: requireStableId(partial.matchId, "UnassignedMatch.matchId"),
    reasonCode: requireStableId(
      partial.reasonCode,
      "UnassignedMatch.reasonCode"
    ),
    message: String(partial.message ?? partial.reasonCode),
    attemptedCourtIds: Object.freeze(attempted),
    blockingConflictIds: Object.freeze(blocking),
  });
}

const CONFLICT_ALLOWED = Object.freeze([
  "conflictId",
  "code",
  "severity",
  "message",
  "matchIds",
  "courtIds",
  "details",
]);

/**
 * @param {object} [partial]
 */
export function createCourtAssignmentConflict(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    CONFLICT_ALLOWED,
    "CourtAssignmentConflict"
  );
  const matchIds = Array.isArray(partial.matchIds)
    ? partial.matchIds.map((id) => String(id))
    : [];
  const courtIds = Array.isArray(partial.courtIds)
    ? partial.courtIds.map((id) => String(id))
    : [];
  return Object.freeze({
    conflictId: requireStableId(
      partial.conflictId,
      "CourtAssignmentConflict.conflictId"
    ),
    code: requireStableId(partial.code, "CourtAssignmentConflict.code"),
    severity: requireEnum(
      partial.severity ?? CONFLICT_SEVERITY.HARD,
      CONFLICT_SEVERITY_VALUES,
      "CourtAssignmentConflict.severity"
    ),
    message: String(partial.message ?? partial.code),
    matchIds: Object.freeze(matchIds),
    courtIds: Object.freeze(courtIds),
    details: cloneFreezeObject(
      partial.details,
      "CourtAssignmentConflict.details"
    ),
  });
}
