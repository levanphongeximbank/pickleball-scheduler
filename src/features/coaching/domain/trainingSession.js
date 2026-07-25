/**
 * TrainingSession + SessionSchedule (COACHING-01).
 * venueId/courtId are typed references — Venue & Court own availability.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import {
  SESSION_ALLOWED_TRANSITIONS,
  SESSION_STATUS,
  isAllowedTransition,
  isSessionStatus,
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
  resolveNowIso,
} from "./helpers.js";

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createSessionSchedule(input = {}) {
  const startsAt = requireIsoTimestamp(input.startsAt, "startsAt");
  const endsAt = requireIsoTimestamp(input.endsAt, "endsAt");
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      "SessionSchedule endsAt must be after startsAt.",
      { startsAt, endsAt }
    );
  }
  return Object.freeze({
    startsAt,
    endsAt,
    venueId: optionalId(input.venueId, "venueId"),
    courtId: optionalId(input.courtId, "courtId"),
    timezone: optionalTrimmedString(input.timezone, "timezone", 64),
  });
}

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createTrainingSession(input = {}, deps = {}) {
  const status =
    input.status != null ? String(input.status) : SESSION_STATUS.DRAFT;
  if (!isSessionStatus(status)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid session status: ${status}`,
      { status }
    );
  }
  const schedule =
    input.schedule != null
      ? createSessionSchedule(input.schedule, deps)
      : input.startsAt
        ? createSessionSchedule(input, deps)
        : null;
  if (
    (status === SESSION_STATUS.SCHEDULED ||
      status === SESSION_STATUS.CONFIRMED) &&
    !schedule
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      "Scheduled/confirmed sessions require SessionSchedule intent.",
      { status }
    );
  }
  return createScopedAggregateBase(input, deps, {
    idField: "sessionId",
    idPrefix: "sess",
    status,
    extra: {
      programId: requireNonEmptyId(input.programId, "programId"),
      lessonId: optionalId(input.lessonId, "lessonId"),
      coachReferenceId: optionalId(input.coachReferenceId, "coachReferenceId"),
      enrollmentId: optionalId(input.enrollmentId, "enrollmentId"),
      schedule,
      notes: optionalTrimmedString(input.notes, "notes"),
    },
  });
}

/**
 * Attach or replace scheduling intent and move draft → scheduled when appropriate.
 *
 * @param {object} session
 * @param {object} scheduleInput
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number, confirm?: boolean }} options
 */
export function scheduleTrainingSession(
  session,
  scheduleInput,
  deps = {},
  options = {}
) {
  assertExpectedVersion(session, options.expectedVersion, "TrainingSession");
  if (
    session.status === SESSION_STATUS.COMPLETED ||
    session.status === SESSION_STATUS.CANCELLED
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      `Cannot schedule TrainingSession in status ${session.status}.`,
      { status: session.status }
    );
  }
  const schedule = createSessionSchedule(scheduleInput, deps);
  let nextStatus = session.status;
  if (session.status === SESSION_STATUS.DRAFT) {
    nextStatus = SESSION_STATUS.SCHEDULED;
  }
  if (options.confirm === true) {
    if (
      nextStatus !== SESSION_STATUS.SCHEDULED &&
      session.status !== SESSION_STATUS.SCHEDULED
    ) {
      throwCoachingError(
        COACHING_ERROR_CODES.INVALID_TRANSITION,
        "Only scheduled sessions can be confirmed.",
        { status: session.status }
      );
    }
    nextStatus = SESSION_STATUS.CONFIRMED;
  }
  return bumpVersion(
    session,
    {
      schedule,
      venueId: schedule.venueId ?? session.venueId,
      status: nextStatus,
    },
    resolveNowIso(deps)
  );
}

/**
 * @param {object} session
 * @param {string} nextStatus
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number }} options
 */
export function transitionTrainingSession(
  session,
  nextStatus,
  deps = {},
  options = {}
) {
  assertExpectedVersion(session, options.expectedVersion, "TrainingSession");
  if (!isSessionStatus(nextStatus)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid session status: ${nextStatus}`,
      { status: nextStatus }
    );
  }
  if (
    !isAllowedTransition(session.status, nextStatus, SESSION_ALLOWED_TRANSITIONS)
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      `Cannot transition TrainingSession from ${session.status} to ${nextStatus}.`,
      { from: session.status, to: nextStatus }
    );
  }
  return bumpVersion(session, { status: nextStatus }, resolveNowIso(deps));
}
