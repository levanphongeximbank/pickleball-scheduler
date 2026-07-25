/**
 * Curriculum + Lesson aggregates (COACHING-01).
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
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
  requireNonNegativeInt,
  requireTrimmedString,
  resolveNowIso,
} from "./helpers.js";

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createCurriculum(input = {}, deps = {}) {
  return createScopedAggregateBase(input, deps, {
    idField: "curriculumId",
    idPrefix: "cur",
    status: input.status != null ? String(input.status) : "active",
    extra: {
      programId: optionalId(input.programId, "programId"),
      name: requireTrimmedString(input.name, "name", 200),
      description: optionalTrimmedString(input.description, "description"),
    },
  });
}

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createLesson(input = {}, deps = {}) {
  const sequence =
    input.sequence == null ? 1 : requireNonNegativeInt(input.sequence, "sequence");
  if (sequence < 1) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      "Lesson sequence must be >= 1.",
      { field: "sequence" }
    );
  }
  return createScopedAggregateBase(input, deps, {
    idField: "lessonId",
    idPrefix: "les",
    status: input.status != null ? String(input.status) : "active",
    extra: {
      curriculumId: requireNonEmptyId(input.curriculumId, "curriculumId"),
      title: requireTrimmedString(input.title, "title", 200),
      sequence,
      objectives: optionalTrimmedString(input.objectives, "objectives"),
    },
  });
}

/**
 * @param {object} lesson
 * @param {object} patch
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number }} options
 */
export function updateLesson(lesson, patch = {}, deps = {}, options = {}) {
  assertExpectedVersion(lesson, options.expectedVersion, "Lesson");
  const next = {
    title:
      patch.title !== undefined
        ? requireTrimmedString(patch.title, "title", 200)
        : lesson.title,
    sequence:
      patch.sequence !== undefined
        ? (() => {
            const seq = requireNonNegativeInt(patch.sequence, "sequence");
            if (seq < 1) {
              throwCoachingError(
                COACHING_ERROR_CODES.INVALID_INPUT,
                "Lesson sequence must be >= 1.",
                { field: "sequence" }
              );
            }
            return seq;
          })()
        : lesson.sequence,
    objectives:
      patch.objectives !== undefined
        ? optionalTrimmedString(patch.objectives, "objectives")
        : lesson.objectives,
  };
  return bumpVersion(lesson, next, resolveNowIso(deps));
}
