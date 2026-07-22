/**
 * CORE-10 — ConstraintEvaluation + ObjectiveEvaluation contracts.
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import {
  isConstraintKind,
  isObjectiveSense,
} from "../enums/constraintKind.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import {
  rejectUnknownFields,
  requireBoolean,
  requireNonNegativeInt,
  requireStableId,
} from "./shared.js";

const CONSTRAINT_ALLOWED = Object.freeze([
  "constraintId",
  "kind",
  "satisfied",
  "violationMagnitude",
  "message",
]);

const OBJECTIVE_ALLOWED = Object.freeze([
  "objectiveKey",
  "value",
  "sense",
]);

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createConstraintEvaluation(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    CONSTRAINT_ALLOWED,
    "ConstraintEvaluation",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );

  if (!isConstraintKind(partial.kind)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      `Invalid constraint kind: ${partial.kind}`,
      { kind: partial.kind ?? null }
    );
  }

  const message =
    partial.message == null
      ? null
      : typeof partial.message === "string"
        ? partial.message
        : (() => {
            throw new OptimizerContractError(
              OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
              "ConstraintEvaluation.message must be a string when present",
              {}
            );
          })();

  return Object.freeze({
    constraintId: requireStableId(
      partial.constraintId,
      "ConstraintEvaluation.constraintId",
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
    ),
    kind: partial.kind,
    satisfied: requireBoolean(
      partial.satisfied,
      "ConstraintEvaluation.satisfied",
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
    ),
    violationMagnitude: requireNonNegativeInt(
      partial.violationMagnitude,
      "ConstraintEvaluation.violationMagnitude",
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
    ),
    message,
  });
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createObjectiveEvaluation(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    OBJECTIVE_ALLOWED,
    "ObjectiveEvaluation",
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );

  if (!isObjectiveSense(partial.sense)) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      `Invalid objective sense: ${partial.sense}`,
      { sense: partial.sense ?? null }
    );
  }

  if (
    typeof partial.value !== "number" ||
    !Number.isInteger(partial.value) ||
    !Number.isFinite(partial.value)
  ) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
      "ObjectiveEvaluation.value must be a finite integer (quantized)",
      { value: partial.value ?? null }
    );
  }

  return Object.freeze({
    objectiveKey: requireStableId(
      partial.objectiveKey,
      "ObjectiveEvaluation.objectiveKey",
      OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
    ),
    value: partial.value,
    sense: partial.sense,
  });
}
