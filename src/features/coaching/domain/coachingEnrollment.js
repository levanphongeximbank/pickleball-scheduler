/**
 * CoachingEnrollment aggregate (COACHING-01).
 * Stores playerId reference only — not player profile copy.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import {
  ENROLLMENT_ALLOWED_TRANSITIONS,
  ENROLLMENT_STATUS,
  isAllowedTransition,
  isEnrollmentStatus,
} from "../constants/lifecycles.js";
import { throwCoachingError } from "../errors/CoachingError.js";
import {
  assertExpectedVersion,
  optionalId,
  requireNonEmptyId,
} from "./scope.js";
import {
  bumpVersion,
  createScopedAggregateBase,
  resolveNowIso,
} from "./helpers.js";

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createCoachingEnrollment(input = {}, deps = {}) {
  const status =
    input.status != null ? String(input.status) : ENROLLMENT_STATUS.PENDING;
  if (!isEnrollmentStatus(status)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid enrollment status: ${status}`,
      { status }
    );
  }
  return createScopedAggregateBase(input, deps, {
    idField: "enrollmentId",
    idPrefix: "enr",
    status,
    extra: {
      programId: requireNonEmptyId(input.programId, "programId"),
      playerId: requireNonEmptyId(input.playerId, "playerId"),
      coachReferenceId: optionalId(input.coachReferenceId, "coachReferenceId"),
      packageId: optionalId(input.packageId, "packageId"),
      entitlementId: optionalId(input.entitlementId, "entitlementId"),
    },
  });
}

/**
 * @param {object} enrollment
 * @param {string} nextStatus
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number }} options
 */
export function transitionCoachingEnrollment(
  enrollment,
  nextStatus,
  deps = {},
  options = {}
) {
  assertExpectedVersion(enrollment, options.expectedVersion, "CoachingEnrollment");
  if (!isEnrollmentStatus(nextStatus)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid enrollment status: ${nextStatus}`,
      { status: nextStatus }
    );
  }
  if (
    !isAllowedTransition(
      enrollment.status,
      nextStatus,
      ENROLLMENT_ALLOWED_TRANSITIONS
    )
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      `Cannot transition CoachingEnrollment from ${enrollment.status} to ${nextStatus}.`,
      { from: enrollment.status, to: nextStatus }
    );
  }
  return bumpVersion(enrollment, { status: nextStatus }, resolveNowIso(deps));
}
