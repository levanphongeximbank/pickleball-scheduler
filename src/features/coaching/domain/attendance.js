/**
 * AttendanceRecord + append-only AttendanceCorrection (COACHING-01).
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import {
  ATTENDANCE_STATUS,
  isAttendanceStatus,
} from "../constants/lifecycles.js";
import { requireIsoTimestamp } from "../constants/timestamps.js";
import { throwCoachingError } from "../errors/CoachingError.js";
import {
  assertExpectedVersion,
  optionalId,
  requireNonEmptyId,
} from "./scope.js";
import {
  bumpVersion,
  createScopedAggregateBase,
  optionalTrimmedString,
  requireTrimmedString,
  resolveId,
  resolveNowIso,
} from "./helpers.js";

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createAttendanceRecord(input = {}, deps = {}) {
  const status =
    input.status != null ? String(input.status) : ATTENDANCE_STATUS.PRESENT;
  if (!isAttendanceStatus(status)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid attendance status: ${status}`,
      { status }
    );
  }
  return createScopedAggregateBase(input, deps, {
    idField: "attendanceId",
    idPrefix: "att",
    status,
    extra: {
      sessionId: requireNonEmptyId(input.sessionId, "sessionId"),
      playerId: requireNonEmptyId(input.playerId, "playerId"),
      enrollmentId: optionalId(input.enrollmentId, "enrollmentId"),
      recordedByActorId: optionalId(input.recordedByActorId, "recordedByActorId"),
      notes: optionalTrimmedString(input.notes, "notes"),
    },
  });
}

/**
 * Append-only correction — never silently overwrite history.
 * Returns { attendance, correction } where attendance reflects corrected value
 * and correction preserves previous → corrected with reason/actor.
 *
 * @param {object} attendance
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} deps
 * @param {{ expectedVersion: number }} options
 */
export function correctAttendanceRecord(
  attendance,
  input = {},
  deps = {},
  options = {}
) {
  assertExpectedVersion(attendance, options.expectedVersion, "AttendanceRecord");
  const correctedStatus = String(input.correctedStatus || input.status || "");
  if (!isAttendanceStatus(correctedStatus)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid corrected attendance status: ${correctedStatus}`,
      { status: correctedStatus }
    );
  }
  if (correctedStatus === attendance.status) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      "Attendance correction must change status.",
      { status: attendance.status }
    );
  }
  const reason = requireTrimmedString(input.reason, "reason", 1000);
  const actorId = requireNonEmptyId(
    input.actorId ?? input.correctedByActorId,
    "actorId"
  );
  const now = resolveNowIso(deps);
  const correctedAt = input.correctedAt
    ? requireIsoTimestamp(input.correctedAt, "correctedAt")
    : now;

  const correction = Object.freeze({
    correctionId: resolveId(
      deps,
      "acorr",
      input.correctionId,
      "correctionId"
    ),
    tenantId: attendance.tenantId,
    clubId: attendance.clubId,
    venueId: attendance.venueId,
    attendanceId: attendance.attendanceId,
    previousStatus: attendance.status,
    correctedStatus,
    reason,
    actorId,
    correctedAt,
    createdAt: now,
    // Append-only: corrections are immutable; version fixed at 1.
    version: 1,
  });

  const updated = bumpVersion(
    attendance,
    {
      status: correctedStatus,
      notes:
        input.notes !== undefined
          ? optionalTrimmedString(input.notes, "notes")
          : attendance.notes,
    },
    now
  );

  return Object.freeze({ attendance: updated, correction });
}
