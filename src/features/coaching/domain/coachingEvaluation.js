/**
 * CoachingEvaluation aggregate (COACHING-01).
 * Submitted evaluations are immutable; revisions are explicit new records.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import {
  EVALUATION_ALLOWED_TRANSITIONS,
  EVALUATION_STATUS,
  isAllowedTransition,
  isEvaluationStatus,
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
  optionalTrimmedString,
  requireTrimmedString,
  resolveNowIso,
} from "./helpers.js";

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 */
export function createCoachingEvaluation(input = {}, deps = {}) {
  const status =
    input.status != null ? String(input.status) : EVALUATION_STATUS.DRAFT;
  if (!isEvaluationStatus(status)) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_STATUS,
      `Invalid evaluation status: ${status}`,
      { status }
    );
  }
  const rating =
    input.rating == null
      ? null
      : (() => {
          if (
            typeof input.rating !== "number" ||
            !Number.isFinite(input.rating) ||
            input.rating < 0 ||
            input.rating > 10
          ) {
            throwCoachingError(
              COACHING_ERROR_CODES.INVALID_INPUT,
              "rating must be a finite number between 0 and 10.",
              { field: "rating" }
            );
          }
          return input.rating;
        })();

  return createScopedAggregateBase(input, deps, {
    idField: "evaluationId",
    idPrefix: "eval",
    status,
    extra: {
      playerId: requireNonEmptyId(input.playerId, "playerId"),
      coachReferenceId: optionalId(input.coachReferenceId, "coachReferenceId"),
      sessionId: optionalId(input.sessionId, "sessionId"),
      programId: optionalId(input.programId, "programId"),
      summary:
        status === EVALUATION_STATUS.SUBMITTED
          ? requireTrimmedString(input.summary, "summary", 4000)
          : optionalTrimmedString(input.summary, "summary", 4000),
      rating,
      revisesEvaluationId: optionalId(
        input.revisesEvaluationId,
        "revisesEvaluationId"
      ),
      submittedAt: null,
    },
  });
}

/**
 * @param {object} evaluation
 * @param {object} patch
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number }} options
 */
export function updateCoachingEvaluationDraft(
  evaluation,
  patch = {},
  deps = {},
  options = {}
) {
  assertExpectedVersion(evaluation, options.expectedVersion, "CoachingEvaluation");
  if (evaluation.status !== EVALUATION_STATUS.DRAFT) {
    throwCoachingError(
      COACHING_ERROR_CODES.IMMUTABLE_RECORD,
      "Submitted evaluations cannot be silently overwritten; create an explicit revision.",
      { status: evaluation.status, evaluationId: evaluation.evaluationId }
    );
  }
  const next = {
    summary:
      patch.summary !== undefined
        ? optionalTrimmedString(patch.summary, "summary", 4000)
        : evaluation.summary,
    rating:
      patch.rating !== undefined
        ? patch.rating == null
          ? null
          : (() => {
              if (
                typeof patch.rating !== "number" ||
                !Number.isFinite(patch.rating) ||
                patch.rating < 0 ||
                patch.rating > 10
              ) {
                throwCoachingError(
                  COACHING_ERROR_CODES.INVALID_INPUT,
                  "rating must be a finite number between 0 and 10.",
                  { field: "rating" }
                );
              }
              return patch.rating;
            })()
        : evaluation.rating,
  };
  return bumpVersion(evaluation, next, resolveNowIso(deps));
}

/**
 * @param {object} evaluation
 * @param {{ nowIso?: () => string }} deps
 * @param {{ expectedVersion: number }} options
 */
export function submitCoachingEvaluation(
  evaluation,
  deps = {},
  options = {}
) {
  assertExpectedVersion(evaluation, options.expectedVersion, "CoachingEvaluation");
  if (
    !isAllowedTransition(
      evaluation.status,
      EVALUATION_STATUS.SUBMITTED,
      EVALUATION_ALLOWED_TRANSITIONS
    )
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      `Cannot submit evaluation from status ${evaluation.status}.`,
      { status: evaluation.status }
    );
  }
  if (!evaluation.summary) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      "summary is required to submit an evaluation.",
      { field: "summary" }
    );
  }
  const now = resolveNowIso(deps);
  return bumpVersion(
    evaluation,
    { status: EVALUATION_STATUS.SUBMITTED, submittedAt: now },
    now
  );
}

/**
 * Explicit revision of a submitted evaluation — new aggregate linked via revisesEvaluationId.
 *
 * @param {object} submitted
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} deps
 */
export function createEvaluationRevision(submitted, input = {}, deps = {}) {
  if (submitted.status !== EVALUATION_STATUS.SUBMITTED) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_TRANSITION,
      "Only submitted evaluations can be revised.",
      { status: submitted.status }
    );
  }
  return createCoachingEvaluation(
    {
      tenantId: submitted.tenantId,
      clubId: submitted.clubId,
      venueId: submitted.venueId,
      playerId: submitted.playerId,
      coachReferenceId: submitted.coachReferenceId,
      sessionId: submitted.sessionId,
      programId: submitted.programId,
      summary: input.summary ?? submitted.summary,
      rating: input.rating !== undefined ? input.rating : submitted.rating,
      revisesEvaluationId: submitted.evaluationId,
      status: EVALUATION_STATUS.DRAFT,
      evaluationId: input.evaluationId,
    },
    deps
  );
}
