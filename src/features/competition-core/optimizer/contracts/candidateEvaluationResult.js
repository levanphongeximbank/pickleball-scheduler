/**
 * CORE-10 Phase 1C-B2-A — CandidateEvaluationResult (immutable).
 * Status invariants are fail-closed. Failure-path purity: no partial
 * violations, objectives, or scores on INVALID_CANDIDATE / EVALUATION_FAILED.
 */

import {
  CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION,
} from "../constants/versions.js";
import { CANDIDATE_EVALUATION_STATUS } from "../enums/candidateEvaluationStatus.js";
import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { isOptimizationOperation } from "../enums/optimizationOperation.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import {
  deepFreezeCanonical,
  isPlainObject,
} from "../deterministic/canonicalize.js";
import { serializeCanonical } from "../deterministic/fingerprint.js";
import { createHardViolation } from "./hardViolation.js";
import { createObjectiveEvaluationRecord } from "./objectiveEvaluationRecord.js";
import { createOptimizationScore } from "./optimizationScore.js";
import {
  createCandidateEvaluationFailure,
  CANDIDATE_EVALUATION_FAILURE_STAGE,
} from "./candidateEvaluationFailure.js";
import { rejectUnknownFields, requireStableId } from "./shared.js";

const FAIL =
  CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT;

const ALLOWED = Object.freeze([
  "candidateId",
  "operation",
  "status",
  "feasible",
  "structuralViolations",
  "businessViolations",
  "allHardViolations",
  "objectiveEvaluations",
  "optimizationScore",
  "failure",
  "portDescriptor",
  "inputFingerprint",
  "evaluationVersion",
  "schemaVersion",
]);

const PORT_DESCRIPTOR_ALLOWED = Object.freeze(["portId", "portVersion"]);

const STATUS_VALUES = Object.freeze(Object.values(CANDIDATE_EVALUATION_STATUS));

/**
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isThenable(value) {
  return (
    value != null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof /** @type {{ then?: unknown }} */ (value).then === "function"
  );
}

/**
 * @param {unknown} raw
 * @param {string} field
 * @returns {ReadonlyArray<object>}
 */
function normalizeHardViolations(raw, field) {
  if (!Array.isArray(raw)) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be an array`,
      { field }
    );
  }
  const source = raw.slice();
  return Object.freeze(
    source.map((item, i) => {
      try {
        return createHardViolation(
          item && typeof item === "object"
            ? { .../** @type {object} */ (item) }
            : {}
        );
      } catch (err) {
        if (err instanceof OptimizerContractError) {
          throw new OptimizerContractError(
            FAIL,
            `${field}[${i}] is not a valid HardViolation`,
            { field, index: i, causeCode: err.code }
          );
        }
        throw err;
      }
    })
  );
}

/**
 * @param {unknown} raw
 * @returns {ReadonlyArray<object>}
 */
function normalizeObjectiveEvaluations(raw) {
  if (!Array.isArray(raw)) {
    throw new OptimizerContractError(
      FAIL,
      "objectiveEvaluations must be an array",
      {}
    );
  }
  const source = raw.slice();
  return Object.freeze(
    source.map((item, i) => {
      try {
        return createObjectiveEvaluationRecord(
          item && typeof item === "object"
            ? { .../** @type {object} */ (item) }
            : {}
        );
      } catch (err) {
        if (err instanceof OptimizerContractError) {
          throw new OptimizerContractError(
            FAIL,
            `objectiveEvaluations[${i}] is not a valid ObjectiveEvaluationRecord`,
            { index: i, causeCode: err.code }
          );
        }
        throw err;
      }
    })
  );
}

/**
 * @param {unknown} raw
 * @returns {Readonly<object> | null}
 */
function normalizeScore(raw) {
  if (raw == null) return null;
  if (!isPlainObject(raw)) {
    throw new OptimizerContractError(
      FAIL,
      "optimizationScore must be a plain object or null",
      {}
    );
  }
  try {
    return createOptimizationScore({ .../** @type {object} */ (raw) });
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      throw new OptimizerContractError(
        FAIL,
        "optimizationScore is not a valid OptimizationScore",
        { causeCode: err.code }
      );
    }
    throw err;
  }
}

/**
 * @param {unknown} raw
 * @returns {Readonly<object> | null}
 */
function normalizeFailure(raw) {
  if (raw == null) return null;
  if (!isPlainObject(raw)) {
    throw new OptimizerContractError(
      FAIL,
      "failure must be a plain object or null",
      {}
    );
  }
  try {
    return createCandidateEvaluationFailure({
      .../** @type {object} */ (raw),
    });
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      throw new OptimizerContractError(
        FAIL,
        "failure is not a valid CandidateEvaluationFailure",
        { causeCode: err.code }
      );
    }
    throw err;
  }
}

/**
 * @param {unknown} raw
 * @returns {Readonly<{ portId: string, portVersion: string }> | null}
 */
function normalizePortDescriptor(raw) {
  if (raw == null) return null;
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
 * @param {ReadonlyArray<object>} left
 * @param {ReadonlyArray<object>} right
 * @returns {boolean}
 */
function hardViolationArraysEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (serializeCanonical(left[i]) !== serializeCanonical(right[i])) {
      return false;
    }
  }
  return true;
}

/**
 * @param {ReadonlyArray<object>} records
 * @param {ReadonlyArray<number>} objectiveValues
 * @returns {boolean}
 */
function orientedValuesAlign(records, objectiveValues) {
  if (records.length !== objectiveValues.length) return false;
  for (let i = 0; i < records.length; i += 1) {
    if (records[i].orientedValue !== objectiveValues[i]) return false;
  }
  return true;
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createCandidateEvaluationResult(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationResult must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "CandidateEvaluationResult",
    FAIL
  );

  for (const key of ALLOWED) {
    const v = ownValue(partial, key);
    if (typeof v === "function") {
      throw new OptimizerContractError(
        FAIL,
        `CandidateEvaluationResult.${key} must not be a function`,
        { field: key }
      );
    }
    if (isThenable(v)) {
      throw new OptimizerContractError(
        FAIL,
        `CandidateEvaluationResult.${key} must not be a Promise/thenable`,
        { field: key }
      );
    }
    if (v instanceof Error) {
      throw new OptimizerContractError(
        FAIL,
        `CandidateEvaluationResult.${key} must not be an Error`,
        { field: key }
      );
    }
  }

  const schemaVersion = requireStableId(
    ownValue(partial, "schemaVersion") ??
      CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION,
    "CandidateEvaluationResult.schemaVersion",
    FAIL
  );
  if (schemaVersion !== CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION) {
    throw new OptimizerContractError(
      FAIL,
      `Unsupported CandidateEvaluationResult.schemaVersion: ${schemaVersion}`,
      {
        schemaVersion,
        expected: CORE10_CANDIDATE_EVALUATION_RESULT_SCHEMA_VERSION,
      }
    );
  }

  const evaluationVersion = requireStableId(
    ownValue(partial, "evaluationVersion") ??
      CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
    "CandidateEvaluationResult.evaluationVersion",
    FAIL
  );
  if (evaluationVersion !== CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION) {
    throw new OptimizerContractError(
      FAIL,
      `Unsupported CandidateEvaluationResult.evaluationVersion: ${evaluationVersion}`,
      {
        evaluationVersion,
        expected: CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
      }
    );
  }

  const status = ownValue(partial, "status");
  if (typeof status !== "string" || !STATUS_VALUES.includes(status)) {
    throw new OptimizerContractError(
      FAIL,
      `Unknown CandidateEvaluationResult.status: ${status}`,
      { status: status ?? null }
    );
  }

  const feasible = ownValue(partial, "feasible");
  if (typeof feasible !== "boolean") {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationResult.feasible must be a boolean",
      { feasible: feasible ?? null }
    );
  }

  const candidateIdRaw = Object.prototype.hasOwnProperty.call(
    partial,
    "candidateId"
  )
    ? ownValue(partial, "candidateId")
    : undefined;
  let candidateId = null;
  if (candidateIdRaw != null) {
    candidateId = requireStableId(
      candidateIdRaw,
      "CandidateEvaluationResult.candidateId",
      FAIL
    );
  }

  const operationRaw = Object.prototype.hasOwnProperty.call(partial, "operation")
    ? ownValue(partial, "operation")
    : undefined;
  let operation = null;
  if (operationRaw != null) {
    if (!isOptimizationOperation(operationRaw)) {
      throw new OptimizerContractError(
        FAIL,
        "CandidateEvaluationResult.operation is not a supported optimization operation",
        { operation: operationRaw }
      );
    }
    operation = /** @type {string} */ (operationRaw);
  }

  const structuralViolations = normalizeHardViolations(
    ownValue(partial, "structuralViolations") ?? [],
    "structuralViolations"
  );
  const businessViolations = normalizeHardViolations(
    ownValue(partial, "businessViolations") ?? [],
    "businessViolations"
  );
  const allHardViolations = normalizeHardViolations(
    ownValue(partial, "allHardViolations") ?? [],
    "allHardViolations"
  );
  const objectiveEvaluations = normalizeObjectiveEvaluations(
    ownValue(partial, "objectiveEvaluations") ?? []
  );
  const optimizationScore = normalizeScore(
    Object.prototype.hasOwnProperty.call(partial, "optimizationScore")
      ? ownValue(partial, "optimizationScore")
      : null
  );
  const failure = normalizeFailure(
    Object.prototype.hasOwnProperty.call(partial, "failure")
      ? ownValue(partial, "failure")
      : null
  );
  const portDescriptor = normalizePortDescriptor(
    Object.prototype.hasOwnProperty.call(partial, "portDescriptor")
      ? ownValue(partial, "portDescriptor")
      : null
  );

  const inputFingerprintRaw = Object.prototype.hasOwnProperty.call(
    partial,
    "inputFingerprint"
  )
    ? ownValue(partial, "inputFingerprint")
    : null;
  let inputFingerprint = null;
  if (inputFingerprintRaw != null) {
    inputFingerprint = requireStableId(
      inputFingerprintRaw,
      "CandidateEvaluationResult.inputFingerprint",
      FAIL
    );
  }

  // Phase 1C-B2: structuralViolations always empty.
  if (structuralViolations.length !== 0) {
    throw new OptimizerContractError(
      FAIL,
      "structuralViolations must remain empty in Phase 1C-B2",
      { length: structuralViolations.length }
    );
  }

  if (status === CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE) {
    if (candidateId == null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE requires a non-empty candidateId",
        {}
      );
    }
    if (operation == null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE requires a valid operation",
        {}
      );
    }
    if (feasible !== true) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE requires feasible=true",
        {}
      );
    }
    if (
      businessViolations.length !== 0 ||
      allHardViolations.length !== 0
    ) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE requires empty hard-violation arrays",
        {}
      );
    }
    if (failure != null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE requires failure=null",
        {}
      );
    }
    if (optimizationScore == null || optimizationScore.feasible !== true) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE requires a feasible optimizationScore",
        {}
      );
    }
    if (optimizationScore.hardViolationCount !== 0) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE score hardViolationCount must be 0",
        {}
      );
    }
    if (optimizationScore.candidateId !== candidateId) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE score.candidateId must equal result.candidateId",
        {}
      );
    }
    if (
      !orientedValuesAlign(
        objectiveEvaluations,
        optimizationScore.objectiveValues
      )
    ) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE score.objectiveValues must equal orientedValues in order",
        {}
      );
    }
    if (inputFingerprint == null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE requires a non-empty inputFingerprint",
        {}
      );
    }
    if (portDescriptor == null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_FEASIBLE requires portDescriptor",
        {}
      );
    }
  } else if (status === CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE) {
    if (candidateId == null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires a non-empty candidateId",
        {}
      );
    }
    if (operation == null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires a valid operation",
        {}
      );
    }
    if (feasible !== false) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires feasible=false",
        {}
      );
    }
    if (businessViolations.length < 1) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires at least one business HardViolation",
        {}
      );
    }
    if (!hardViolationArraysEqual(allHardViolations, businessViolations)) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires allHardViolations deeply equal to businessViolations",
        {}
      );
    }
    if (objectiveEvaluations.length !== 0) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires objectiveEvaluations=[]",
        {}
      );
    }
    if (failure != null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires failure=null",
        {}
      );
    }
    if (optimizationScore == null || optimizationScore.feasible !== false) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires an infeasible optimizationScore",
        {}
      );
    }
    if (optimizationScore.hardViolationCount !== allHardViolations.length) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE score.hardViolationCount must equal allHardViolations.length",
        {
          hardViolationCount: optimizationScore.hardViolationCount,
          allHardViolationsLength: allHardViolations.length,
        }
      );
    }
    if (optimizationScore.objectiveValues.length !== 0) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE score.objectiveValues must be []",
        {}
      );
    }
    if (optimizationScore.candidateId !== candidateId) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE score.candidateId must equal result.candidateId",
        {}
      );
    }
    if (inputFingerprint == null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires a non-empty inputFingerprint",
        {}
      );
    }
    if (portDescriptor == null) {
      throw new OptimizerContractError(
        FAIL,
        "VALID_INFEASIBLE requires portDescriptor",
        {}
      );
    }
  } else if (status === CANDIDATE_EVALUATION_STATUS.INVALID_CANDIDATE) {
    if (feasible !== false) {
      throw new OptimizerContractError(
        FAIL,
        "INVALID_CANDIDATE requires feasible=false",
        {}
      );
    }
    if (
      businessViolations.length !== 0 ||
      allHardViolations.length !== 0 ||
      objectiveEvaluations.length !== 0
    ) {
      throw new OptimizerContractError(
        FAIL,
        "INVALID_CANDIDATE requires empty violations and objectives (failure-path purity)",
        {}
      );
    }
    if (optimizationScore != null) {
      throw new OptimizerContractError(
        FAIL,
        "INVALID_CANDIDATE requires optimizationScore=null",
        {}
      );
    }
    if (failure == null) {
      throw new OptimizerContractError(
        FAIL,
        "INVALID_CANDIDATE requires a failure record",
        {}
      );
    }
    if (
      failure.stage !== CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION
    ) {
      throw new OptimizerContractError(
        FAIL,
        "INVALID_CANDIDATE failure.stage must be INPUT_VALIDATION",
        { stage: failure.stage }
      );
    }
    if (portDescriptor != null) {
      throw new OptimizerContractError(
        FAIL,
        "INVALID_CANDIDATE requires portDescriptor=null",
        {}
      );
    }
    if (inputFingerprint != null) {
      throw new OptimizerContractError(
        FAIL,
        "INVALID_CANDIDATE requires inputFingerprint=null",
        {}
      );
    }
  } else if (status === CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED) {
    if (feasible !== false) {
      throw new OptimizerContractError(
        FAIL,
        "EVALUATION_FAILED requires feasible=false",
        {}
      );
    }
    if (
      businessViolations.length !== 0 ||
      allHardViolations.length !== 0 ||
      objectiveEvaluations.length !== 0
    ) {
      throw new OptimizerContractError(
        FAIL,
        "EVALUATION_FAILED requires empty violations and objectives (failure-path purity)",
        {}
      );
    }
    if (optimizationScore != null) {
      throw new OptimizerContractError(
        FAIL,
        "EVALUATION_FAILED requires optimizationScore=null",
        {}
      );
    }
    if (failure == null) {
      throw new OptimizerContractError(
        FAIL,
        "EVALUATION_FAILED requires a failure record",
        {}
      );
    }
    if (
      failure.stage === CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION
    ) {
      throw new OptimizerContractError(
        FAIL,
        "EVALUATION_FAILED failure.stage must not be INPUT_VALIDATION",
        { stage: failure.stage }
      );
    }
    // Stage-gated purity: dependency validation has not yet certified port/fingerprint.
    if (
      failure.stage ===
      CANDIDATE_EVALUATION_FAILURE_STAGE.DEPENDENCY_VALIDATION
    ) {
      if (portDescriptor != null) {
        throw new OptimizerContractError(
          FAIL,
          "EVALUATION_FAILED at DEPENDENCY_VALIDATION requires portDescriptor=null",
          {}
        );
      }
      if (inputFingerprint != null) {
        throw new OptimizerContractError(
          FAIL,
          "EVALUATION_FAILED at DEPENDENCY_VALIDATION requires inputFingerprint=null",
          {}
        );
      }
    }
  } else {
    throw new OptimizerContractError(
      FAIL,
      `Unsupported CandidateEvaluationResult.status: ${status}`,
      { status }
    );
  }

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        schemaVersion,
        evaluationVersion,
        candidateId,
        operation,
        status,
        feasible,
        structuralViolations,
        businessViolations,
        allHardViolations,
        objectiveEvaluations,
        optimizationScore,
        failure,
        portDescriptor,
        inputFingerprint,
      },
      "CandidateEvaluationResult"
    )
  );
}
