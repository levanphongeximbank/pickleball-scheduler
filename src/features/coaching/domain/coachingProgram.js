/**
 * CoachingProgram aggregate (COACHING-01).
 * Owns program lifecycle only — not coach identity, player profile, or finance.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import {
  PROGRAM_ALLOWED_TRANSITIONS,
  PROGRAM_STATUS,
  isAllowedTransition,
  isProgramStatus,
} from "../constants/lifecycles.js";
import { throwCoachingError } from "../errors/CoachingError.js";
import {
  assertExpectedVersion,
  optionalId,
} from "./scope.js";
import {
  bumpVersion,
  createScopedAggregateBase,
  optionalTrimmedString,
  requireTrimmedString,
  resolveNowIso,
} from "./helpers.js";

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createCoachingProgram(input = {}, deps = {}) {
  const status =
    input.status != null ? String(input.status) : PROGRAM_STATUS.DRAFT;
  if (!isProgramStatus(status)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid program status: ${status}`,
      { status }
    );
  }
  const name = requireTrimmedString(input.name, "name", 200);
  return createScopedAggregateBase(input, deps, {
    idField: "programId",
    idPrefix: "prog",
    status,
    extra: {
      name,
      description: optionalTrimmedString(input.description, "description"),
      curriculumId: optionalId(input.curriculumId, "curriculumId"),
    },
  });
}

/**
 * @param {object} program
 * @param {string} nextStatus
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number }} options
 */
export function transitionCoachingProgram(
  program,
  nextStatus,
  deps = {},
  options = {}
) {
  assertExpectedVersion(program, options.expectedVersion, "CoachingProgram");
  if (!isProgramStatus(nextStatus)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid program status: ${nextStatus}`,
      { status: nextStatus }
    );
  }
  if (
    !isAllowedTransition(program.status, nextStatus, PROGRAM_ALLOWED_TRANSITIONS)
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      `Cannot transition CoachingProgram from ${program.status} to ${nextStatus}.`,
      { from: program.status, to: nextStatus }
    );
  }
  return bumpVersion(program, { status: nextStatus }, resolveNowIso(deps));
}

/**
 * @param {object} program
 * @param {object} patch
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number }} options
 */
export function updateCoachingProgram(program, patch = {}, deps = {}, options = {}) {
  assertExpectedVersion(program, options.expectedVersion, "CoachingProgram");
  if (
    program.status === PROGRAM_STATUS.ARCHIVED ||
    program.status === PROGRAM_STATUS.COMPLETED
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.IMMUTABLE_RECORD,
      `Cannot update CoachingProgram in status ${program.status}.`,
      { status: program.status }
    );
  }
  const next = {
    name:
      patch.name !== undefined
        ? requireTrimmedString(patch.name, "name", 200)
        : program.name,
    description:
      patch.description !== undefined
        ? optionalTrimmedString(patch.description, "description")
        : program.description,
    curriculumId:
      patch.curriculumId !== undefined
        ? optionalId(patch.curriculumId, "curriculumId")
        : program.curriculumId,
  };
  return bumpVersion(program, next, resolveNowIso(deps));
}
