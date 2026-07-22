/**
 * CORE-10 Phase 1C-B2-B — evaluateCandidateSolution orchestration.
 * Synchronous, deterministic candidate evaluation pipeline.
 * Does not implement CORE-01 evaluateCandidate. No solver/search.
 */

import { CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION } from "../constants/versions.js";
import { CANDIDATE_EVALUATION_STATUS } from "../enums/candidateEvaluationStatus.js";
import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { isObjectiveEvaluationFailureCode } from "../enums/objectiveEvaluationFailureCodes.js";
import { isOptimizationOperation } from "../enums/optimizationOperation.js";
import { isOptimizerContractError } from "../errors/OptimizerContractError.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import {
  createCandidateEvaluationFailure,
  CANDIDATE_EVALUATION_FAILURE_STAGE,
} from "../contracts/candidateEvaluationFailure.js";
import { createCandidateEvaluationResult } from "../contracts/candidateEvaluationResult.js";
import { createCandidateEvaluationDependencies } from "../contracts/candidateEvaluationDependencies.js";
import { composeCandidateOptimizationScore } from "../scoring/composeCandidateOptimizationScore.js";
import { evaluateObjectives } from "../objectives/evaluateObjectives.js";
import { validateCandidateEvaluationInput } from "./validateCandidateEvaluationInput.js";
import { composeHardViolations } from "./composeHardViolations.js";
import { createCandidateEvaluationInputFingerprint } from "./candidateEvaluationInputFingerprint.js";

const PORT_INVOCATION_CODES = Object.freeze(
  new Set([
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_EXCEPTION,
    CANDIDATE_EVALUATION_FAILURE_CODE.ASYNC_CONSTRAINT_PORT_UNSUPPORTED,
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CONSTRAINT_PORT_RESULT,
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID,
    CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_UNAVAILABLE,
  ])
);

const HARD_COMPOSITION_CODES = Object.freeze(
  new Set([
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_HARD_VIOLATION,
    CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_HARD_VIOLATION,
    CANDIDATE_EVALUATION_FAILURE_CODE.HARD_VIOLATION_MAGNITUDE_CONFLICT,
  ])
);

const ENVELOPE_THROW_CODES = Object.freeze(
  new Set([
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_RESULT,
    CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_FAILURE,
  ])
);

/**
 * @param {object} obj
 * @param {string} key
 * @returns {unknown}
 */
function ownValue(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * Best-effort stable ID; returns null instead of throwing.
 * @param {unknown} value
 * @returns {string | null}
 */
function bestEffortStableId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed;
}

/**
 * @param {unknown} rawInput
 * @returns {string | null}
 */
function bestEffortCandidateId(rawInput) {
  if (!isPlainObject(rawInput)) return null;
  const candidate = ownValue(/** @type {object} */ (rawInput), "candidate");
  if (!isPlainObject(candidate)) return null;
  return bestEffortStableId(
    ownValue(/** @type {object} */ (candidate), "candidateId")
  );
}

/**
 * @param {unknown} rawInput
 * @returns {string | null}
 */
function bestEffortOperation(rawInput) {
  if (!isPlainObject(rawInput)) return null;
  const candidate = ownValue(/** @type {object} */ (rawInput), "candidate");
  if (!isPlainObject(candidate)) return null;
  const operation = ownValue(/** @type {object} */ (candidate), "operation");
  return isOptimizationOperation(operation)
    ? /** @type {string} */ (operation)
    : null;
}

/**
 * Stable detailsCodes only — no free-text messages.
 * @param {unknown} details
 * @returns {string[]}
 */
function extractStableErrorDetails(details) {
  if (details == null || typeof details !== "object" || Array.isArray(details)) {
    return [];
  }
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  const record = /** @type {Record<string, unknown>} */ (details);
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") {
      const trimmed = value.trim();
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
  }
  return out;
}

/**
 * @param {object} input
 * @returns {object}
 */
function createConstraintPortInput(input) {
  return {
    candidateId: input.candidate.candidateId,
    operation: input.candidate.operation,
    assignments: input.candidate.assignments.map((a) => ({
      variableId: a.variableId,
      valueId: a.valueId,
    })),
    tenantId: input.request.tenantId,
    competitionId: input.request.competitionId,
    snapshotFingerprints: input.context.snapshotRefs.map(
      (snapshot) => snapshot.fingerprint
    ),
    facts: {},
  };
}

/**
 * @param {object} input
 * @returns {object}
 */
function createObjectiveEvaluationInput(input) {
  return {
    candidate: {
      candidateId: input.candidate.candidateId,
      operation: input.candidate.operation,
      assignments: input.candidate.assignments.map((a) => ({
        variableId: a.variableId,
        valueId: a.valueId,
      })),
    },
    requestId: input.request.requestId,
    tenantId: input.request.tenantId,
    competitionId: input.request.competitionId,
    authorityValues: [...input.authorityValues],
    contexts: {},
  };
}

/**
 * @param {object} args
 * @returns {Readonly<object>}
 */
function mapCandidateEvaluationFailure({
  code,
  stage,
  messageCode,
  detailsCodes = [],
  objectiveFailureCode = null,
  candidateId = null,
  portDescriptor = null,
}) {
  return createCandidateEvaluationFailure({
    code,
    stage,
    messageCode: messageCode ?? code,
    detailsCodes,
    objectiveFailureCode,
    candidateId,
    portDescriptor,
  });
}

/**
 * @param {object} args
 * @returns {Readonly<object>}
 */
function createInvalidCandidateResult({
  code,
  detailsCodes,
  candidateId,
  operation,
}) {
  const failure = mapCandidateEvaluationFailure({
    code,
    stage: CANDIDATE_EVALUATION_FAILURE_STAGE.INPUT_VALIDATION,
    messageCode: code,
    detailsCodes,
    candidateId,
    portDescriptor: null,
  });
  return createCandidateEvaluationResult({
    candidateId,
    operation,
    status: CANDIDATE_EVALUATION_STATUS.INVALID_CANDIDATE,
    feasible: false,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations: [],
    optimizationScore: null,
    failure,
    portDescriptor: null,
    inputFingerprint: null,
    evaluationVersion: CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  });
}

/**
 * @param {object} args
 * @returns {Readonly<object>}
 */
function createEvaluationFailedResult({
  code,
  stage,
  detailsCodes = [],
  objectiveFailureCode = null,
  candidateId = null,
  operation = null,
  portDescriptor = null,
  inputFingerprint = null,
}) {
  const failure = mapCandidateEvaluationFailure({
    code,
    stage,
    messageCode: code,
    detailsCodes,
    objectiveFailureCode,
    candidateId,
    portDescriptor,
  });
  return createCandidateEvaluationResult({
    candidateId,
    operation,
    status: CANDIDATE_EVALUATION_STATUS.EVALUATION_FAILED,
    feasible: false,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations: [],
    optimizationScore: null,
    failure,
    portDescriptor,
    inputFingerprint,
    evaluationVersion: CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  });
}

/**
 * @param {object} args
 * @returns {Readonly<object>}
 */
function createValidInfeasibleResult({
  candidateId,
  operation,
  composedViolations,
  authorityValues,
  portDescriptor,
  inputFingerprint,
}) {
  const optimizationScore = composeCandidateOptimizationScore({
    candidateId,
    feasible: false,
    hardViolationCount: composedViolations.length,
    authorityValues: [...authorityValues],
    objectiveEvaluations: [],
  });
  return createCandidateEvaluationResult({
    candidateId,
    operation,
    status: CANDIDATE_EVALUATION_STATUS.VALID_INFEASIBLE,
    feasible: false,
    structuralViolations: [],
    businessViolations: [...composedViolations],
    allHardViolations: [...composedViolations],
    objectiveEvaluations: [],
    optimizationScore,
    failure: null,
    portDescriptor,
    inputFingerprint,
    evaluationVersion: CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  });
}

/**
 * @param {object} args
 * @returns {Readonly<object>}
 */
function createValidFeasibleResult({
  candidateId,
  operation,
  objectiveEvaluations,
  authorityValues,
  portDescriptor,
  inputFingerprint,
}) {
  const optimizationScore = composeCandidateOptimizationScore({
    candidateId,
    feasible: true,
    hardViolationCount: 0,
    authorityValues: [...authorityValues],
    objectiveEvaluations,
  });
  return createCandidateEvaluationResult({
    candidateId,
    operation,
    status: CANDIDATE_EVALUATION_STATUS.VALID_FEASIBLE,
    feasible: true,
    structuralViolations: [],
    businessViolations: [],
    allHardViolations: [],
    objectiveEvaluations,
    optimizationScore,
    failure: null,
    portDescriptor,
    inputFingerprint,
    evaluationVersion: CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  });
}

/**
 * @param {unknown} err
 * @param {object} ctx
 * @returns {Readonly<object>}
 */
function mapUnexpectedFailure(err, ctx) {
  void err;
  return createEvaluationFailedResult({
    code: CANDIDATE_EVALUATION_FAILURE_CODE.CANDIDATE_EVALUATION_UNEXPECTED_FAILURE,
    stage: CANDIDATE_EVALUATION_FAILURE_STAGE.UNEXPECTED_FAILURE,
    detailsCodes: [],
    candidateId: ctx.candidateId ?? null,
    operation: ctx.operation ?? null,
    portDescriptor: ctx.portDescriptor ?? null,
    inputFingerprint: ctx.inputFingerprint ?? null,
  });
}

/**
 * Synchronous deterministic candidate evaluation orchestration.
 *
 * @param {unknown} rawInput
 * @param {unknown} rawDependencies
 * @returns {Readonly<object>}
 */
export function evaluateCandidateSolution(rawInput, rawDependencies) {
  let candidateId = bestEffortCandidateId(rawInput);
  let operation = bestEffortOperation(rawInput);
  /** @type {{ portId: string, portVersion: string } | null} */
  let portDescriptor = null;
  /** @type {string | null} */
  let inputFingerprint = null;

  try {
    const validated = validateCandidateEvaluationInput(rawInput);
    if (!validated.ok) {
      return createInvalidCandidateResult({
        code: validated.code,
        detailsCodes: extractStableErrorDetails(validated.details),
        candidateId,
        operation,
      });
    }

    const input = validated.input;
    candidateId = input.candidate.candidateId;
    operation = input.candidate.operation;

    let dependencies;
    try {
      dependencies = createCandidateEvaluationDependencies(
        rawDependencies && typeof rawDependencies === "object"
          ? /** @type {object} */ (rawDependencies)
          : {}
      );
    } catch (err) {
      if (!isOptimizerContractError(err)) {
        return mapUnexpectedFailure(err, { candidateId, operation });
      }
      if (ENVELOPE_THROW_CODES.has(err.code)) {
        throw err;
      }
      if (
        err.code ===
          CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_UNAVAILABLE ||
        err.code === CANDIDATE_EVALUATION_FAILURE_CODE.CONSTRAINT_PORT_INVALID
      ) {
        return createEvaluationFailedResult({
          code: err.code,
          stage: CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
          detailsCodes: extractStableErrorDetails(err.details),
          candidateId,
          operation,
          portDescriptor: null,
          inputFingerprint: null,
        });
      }
      return createEvaluationFailedResult({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_EVALUATION_DEPENDENCIES,
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.DEPENDENCY_VALIDATION,
        detailsCodes: extractStableErrorDetails(err.details),
        candidateId,
        operation,
        portDescriptor: null,
        inputFingerprint: null,
      });
    }

    portDescriptor = Object.freeze({
      portId: dependencies.constraintEvaluationPort.portId,
      portVersion: dependencies.constraintEvaluationPort.portVersion,
    });

    try {
      inputFingerprint = createCandidateEvaluationInputFingerprint({
        input,
        objectiveRegistry: dependencies.objectiveRegistry,
        constraintEvaluationPort: dependencies.constraintEvaluationPort,
      });
    } catch (err) {
      if (!isOptimizerContractError(err)) {
        return mapUnexpectedFailure(err, {
          candidateId,
          operation,
          portDescriptor,
        });
      }
      if (ENVELOPE_THROW_CODES.has(err.code)) {
        throw err;
      }
      return createEvaluationFailedResult({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT_FINGERPRINT,
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.RESULT_CONSTRUCTION,
        detailsCodes: extractStableErrorDetails(err.details),
        candidateId,
        operation,
        portDescriptor,
        inputFingerprint: null,
      });
    }

    const portInput = createConstraintPortInput(input);
    let portResult;
    try {
      portResult =
        dependencies.constraintEvaluationPort.evaluateConstraints(portInput);
    } catch (err) {
      if (!isOptimizerContractError(err)) {
        return mapUnexpectedFailure(err, {
          candidateId,
          operation,
          portDescriptor,
          inputFingerprint,
        });
      }
      if (ENVELOPE_THROW_CODES.has(err.code)) {
        throw err;
      }
      if (PORT_INVOCATION_CODES.has(err.code)) {
        return createEvaluationFailedResult({
          code: err.code,
          stage: CANDIDATE_EVALUATION_FAILURE_STAGE.CONSTRAINT_PORT,
          detailsCodes: extractStableErrorDetails(err.details),
          candidateId,
          operation,
          portDescriptor,
          inputFingerprint,
        });
      }
      return mapUnexpectedFailure(err, {
        candidateId,
        operation,
        portDescriptor,
        inputFingerprint,
      });
    }

    let composedViolations;
    try {
      composedViolations = composeHardViolations(portResult.violations);
    } catch (err) {
      if (!isOptimizerContractError(err)) {
        return mapUnexpectedFailure(err, {
          candidateId,
          operation,
          portDescriptor,
          inputFingerprint,
        });
      }
      if (ENVELOPE_THROW_CODES.has(err.code)) {
        throw err;
      }
      if (HARD_COMPOSITION_CODES.has(err.code)) {
        return createEvaluationFailedResult({
          code: err.code,
          stage: CANDIDATE_EVALUATION_FAILURE_STAGE.HARD_COMPOSITION,
          detailsCodes: extractStableErrorDetails(err.details),
          candidateId,
          operation,
          portDescriptor,
          inputFingerprint,
        });
      }
      return mapUnexpectedFailure(err, {
        candidateId,
        operation,
        portDescriptor,
        inputFingerprint,
      });
    }

    if (composedViolations.length > 0) {
      try {
        return createValidInfeasibleResult({
          candidateId,
          operation,
          composedViolations,
          authorityValues: input.authorityValues,
          portDescriptor,
          inputFingerprint,
        });
      } catch (err) {
        if (
          isOptimizerContractError(err) &&
          err.code ===
            CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED
        ) {
          return createEvaluationFailedResult({
            code: CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
            stage: CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
            detailsCodes: extractStableErrorDetails(err.details),
            candidateId,
            operation,
            portDescriptor,
            inputFingerprint,
          });
        }
        throw err;
      }
    }

    let objectiveEvaluations;
    try {
      objectiveEvaluations = evaluateObjectives({
        registry: dependencies.objectiveRegistry,
        executionSpecs: input.objectiveExecutionSpecs,
        evaluationInput: createObjectiveEvaluationInput(input),
      });
    } catch (err) {
      if (!isOptimizerContractError(err)) {
        return mapUnexpectedFailure(err, {
          candidateId,
          operation,
          portDescriptor,
          inputFingerprint,
        });
      }
      if (ENVELOPE_THROW_CODES.has(err.code)) {
        throw err;
      }
      const nestedCode = isObjectiveEvaluationFailureCode(err.code)
        ? err.code
        : null;
      const detailsCodes = [];
      if (nestedCode) detailsCodes.push(nestedCode);
      for (const c of extractStableErrorDetails(err.details)) {
        if (!detailsCodes.includes(c)) detailsCodes.push(c);
      }
      return createEvaluationFailedResult({
        code: CANDIDATE_EVALUATION_FAILURE_CODE.OBJECTIVE_EVALUATION_FAILED,
        stage: CANDIDATE_EVALUATION_FAILURE_STAGE.OBJECTIVE_EVALUATION,
        detailsCodes,
        objectiveFailureCode: nestedCode,
        candidateId,
        operation,
        portDescriptor,
        inputFingerprint,
      });
    }

    try {
      return createValidFeasibleResult({
        candidateId,
        operation,
        objectiveEvaluations,
        authorityValues: input.authorityValues,
        portDescriptor,
        inputFingerprint,
      });
    } catch (err) {
      if (
        isOptimizerContractError(err) &&
        err.code === CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED
      ) {
        return createEvaluationFailedResult({
          code: CANDIDATE_EVALUATION_FAILURE_CODE.SCORE_COMPOSITION_FAILED,
          stage: CANDIDATE_EVALUATION_FAILURE_STAGE.SCORE_COMPOSITION,
          detailsCodes: extractStableErrorDetails(err.details),
          candidateId,
          operation,
          portDescriptor,
          inputFingerprint,
        });
      }
      throw err;
    }
  } catch (err) {
    // Envelope / contract construction failures must not be recursively wrapped.
    if (isOptimizerContractError(err)) {
      throw err;
    }
    return mapUnexpectedFailure(err, {
      candidateId,
      operation,
      portDescriptor,
      inputFingerprint,
    });
  }
}
