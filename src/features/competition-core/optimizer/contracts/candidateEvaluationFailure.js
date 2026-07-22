/**
 * CORE-10 Phase 1C-B2-A — CandidateEvaluationFailure (replay-safe).
 * Distinct from run-level OptimizationFailure. No free-text message, stack,
 * Error object, raw exception, or function identity.
 */

import { CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION } from "../constants/versions.js";
import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { isObjectiveEvaluationFailureCode } from "../enums/objectiveEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import {
  deepFreezeCanonical,
  isPlainObject,
} from "../deterministic/canonicalize.js";
import { rejectUnknownFields, requireStableId } from "./shared.js";

const FAIL =
  CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE;

/** Module-internal stage constants (not exported from optimizer/index.js). */
export const CANDIDATE_EVALUATION_FAILURE_STAGE = Object.freeze({
  INPUT_VALIDATION: "INPUT_VALIDATION",
  DEPENDENCY_VALIDATION: "DEPENDENCY_VALIDATION",
  CONSTRAINT_PORT: "CONSTRAINT_PORT",
  HARD_COMPOSITION: "HARD_COMPOSITION",
  OBJECTIVE_EVALUATION: "OBJECTIVE_EVALUATION",
  SCORE_COMPOSITION: "SCORE_COMPOSITION",
  RESULT_CONSTRUCTION: "RESULT_CONSTRUCTION",
  UNEXPECTED_FAILURE: "UNEXPECTED_FAILURE",
});

const STAGE_VALUES = Object.freeze(
  Object.values(CANDIDATE_EVALUATION_FAILURE_STAGE)
);

const ALLOWED = Object.freeze([
  "code",
  "messageCode",
  "stage",
  "detailsCodes",
  "objectiveFailureCode",
  "candidateId",
  "portDescriptor",
  "schemaVersion",
]);

const PORT_DESCRIPTOR_ALLOWED = Object.freeze(["portId", "portVersion"]);

const CODE_VALUES = Object.freeze(
  Object.values(CANDIDATE_EVALUATION_FAILURE_CODE)
);

/**
 * Exact code → allowed stage mapping (fail-closed).
 * @type {Readonly<Record<string, string>>}
 */
const CODE_STAGE = Object.freeze({
  [CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.UNKNOWN_DECISION_VARIABLE]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.ASSIGNMENT_OUTSIDE_DOMAIN]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.MISSING_ASSIGNMENT]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_ASSIGNMENT]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.OPERATION_MISMATCH]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.COMPETITION_SCOPE_MISMATCH]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_SNAPSHOT_BINDING]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,

  [CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.DEPENDENCY_VALIDATION,

  [CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
  [CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_UNAVAILABLE]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
  [CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_EXCEPTION]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
  [CANDIDATE_EVALUATION_FAILURE_CODE.ASYNC_CONSTRAINT_PORT_UNSUPPORTED]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
  [CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,

  [CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_HARD_VIOLATION]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.HARD_VIOLATION_MAGNITUDE_CONFLICT]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_HARD_VIOLATION]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION,

  [CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.OBJECTIVE_EVALUATION,

  [CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,

  [CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,
  [CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT_FINGERPRINT]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,

  [CANDIDATE_EVALUATION_FAILURE_CODE.CANDIDATE_EVALUATION_UNEXPECTED_FAILURE]:
    CANDIDATE_EVALUATION_FAILURE_STAGE.UNEXPECTED_FAILURE,
});

/**
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * @param {unknown} codes
 * @returns {string[]}
 */
function normalizeDetailsCodes(codes) {
  if (codes == null) {
    return [];
  }
  if (!Array.isArray(codes)) {
    throw new OptimizerContractError(
      FAIL,
      "detailsCodes must be an array of stable strings",
      {}
    );
  }
  const source = codes.slice();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < source.length; i += 1) {
    const code = source[i];
    if (typeof code !== "string" || code.trim() === "") {
      throw new OptimizerContractError(
        FAIL,
        `detailsCodes[${i}] must be a non-empty stable string`,
        { index: i }
      );
    }
    const trimmed = code.trim();
    if (seen.has(trimmed)) {
      throw new OptimizerContractError(
        FAIL,
        `Duplicate detailsCodes entry: ${trimmed}`,
        { code: trimmed }
      );
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  out.sort(compareStableString);
  return out;
}

/**
 * @param {unknown} raw
 * @returns {Readonly<{ portId: string, portVersion: string }> | null}
 */
function normalizePortDescriptor(raw) {
  if (raw == null) {
    return null;
  }
  if (!isPlainObject(raw)) {
    throw new OptimizerContractError(
      FAIL,
      "portDescriptor must be a plain object or null",
      {}
    );
  }
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (raw),
    PORT_DESCRIPTOR_ALLOWED,
    "portDescriptor",
    FAIL
  );
  return Object.freeze({
    portId: requireStableId(
      ownValue(/** @type {object} */ (raw), "portId"),
      "portDescriptor.portId",
      FAIL
    ),
    portVersion: requireStableId(
      ownValue(/** @type {object} */ (raw), "portVersion"),
      "portDescriptor.portVersion",
      FAIL
    ),
  });
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createCandidateEvaluationFailure(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationFailure must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "CandidateEvaluationFailure",
    FAIL
  );

  const schemaVersion = requireStableId(
    ownValue(partial, "schemaVersion") ??
      CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION,
    "CandidateEvaluationFailure.schemaVersion",
    FAIL
  );
  if (schemaVersion !== CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION) {
    throw new OptimizerContractError(
      FAIL,
      `Unsupported CandidateEvaluationFailure.schemaVersion: ${schemaVersion}`,
      {
        schemaVersion,
        expected: CORE10_CANDIDATE_EVALUATION_FAILURE_SCHEMA_VERSION,
      }
    );
  }

  const code = ownValue(partial, "code");
  if (typeof code !== "string" || !CODE_VALUES.includes(code)) {
    throw new OptimizerContractError(
      FAIL,
      `Unknown CandidateEvaluationFailure.code: ${code}`,
      { code: code ?? null }
    );
  }

  // Reserved throw-only code — must never be stored as a pipeline failure outcome.
  if (
    code ===
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE
  ) {
    throw new OptimizerContractError(
      FAIL,
      "INVALID_CANDIDATE_EVALUATION_FAILURE is reserved for contract-validation throws and cannot be stored as a pipeline failure code",
      { code }
    );
  }

  for (const key of ALLOWED) {
    const v = ownValue(partial, key);
    if (typeof v === "function") {
      throw new OptimizerContractError(
        FAIL,
        `CandidateEvaluationFailure.${key} must not be a function`,
        { field: key }
      );
    }
    if (
      v != null &&
      (typeof v === "object" || typeof v === "function") &&
      typeof /** @type {{ then?: unknown }} */ (v).then === "function"
    ) {
      throw new OptimizerContractError(
        FAIL,
        `CandidateEvaluationFailure.${key} must not be a Promise/thenable`,
        { field: key }
      );
    }
    if (v instanceof Error) {
      throw new OptimizerContractError(
        FAIL,
        `CandidateEvaluationFailure.${key} must not be an Error`,
        { field: key }
      );
    }
  }

  const stage = ownValue(partial, "stage");
  if (typeof stage !== "string" || !STAGE_VALUES.includes(stage)) {
    throw new OptimizerContractError(
      FAIL,
      `Unknown CandidateEvaluationFailure.stage: ${stage}`,
      { stage: stage ?? null }
    );
  }

  const expectedStage = CODE_STAGE[code];
  if (expectedStage !== stage) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationFailure code/stage combination is incompatible",
      { code, stage, expectedStage }
    );
  }

  const messageCode = requireStableId(
    ownValue(partial, "messageCode"),
    "CandidateEvaluationFailure.messageCode",
    FAIL
  );

  const objectiveFailureCodeRaw = Object.prototype.hasOwnProperty.call(
    partial,
    "objectiveFailureCode"
  )
    ? ownValue(partial, "objectiveFailureCode")
    : null;
  let objectiveFailureCode = null;
  if (objectiveFailureCodeRaw != null) {
    if (!isObjectiveEvaluationFailureCode(objectiveFailureCodeRaw)) {
      throw new OptimizerContractError(
        FAIL,
        "objectiveFailureCode must be a Phase 1C-A objective failure code or null",
        { objectiveFailureCode: objectiveFailureCodeRaw }
      );
    }
    objectiveFailureCode = /** @type {string} */ (objectiveFailureCodeRaw);
  }

  const candidateIdRaw = Object.prototype.hasOwnProperty.call(
    partial,
    "candidateId"
  )
    ? ownValue(partial, "candidateId")
    : null;
  let candidateId = null;
  if (candidateIdRaw != null) {
    candidateId = requireStableId(
      candidateIdRaw,
      "CandidateEvaluationFailure.candidateId",
      FAIL
    );
  }

  const portDescriptor = normalizePortDescriptor(
    Object.prototype.hasOwnProperty.call(partial, "portDescriptor")
      ? ownValue(partial, "portDescriptor")
      : null
  );

  const detailsCodes = normalizeDetailsCodes(
    Object.prototype.hasOwnProperty.call(partial, "detailsCodes")
      ? ownValue(partial, "detailsCodes")
      : []
  );

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        schemaVersion,
        code,
        messageCode,
        stage,
        detailsCodes,
        objectiveFailureCode,
        candidateId,
        portDescriptor,
      },
      "CandidateEvaluationFailure"
    )
  );
}
