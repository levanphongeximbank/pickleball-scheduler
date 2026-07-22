/**
 * CORE-10 Phase 1C-B2-A — candidate evaluation input fingerprint.
 * Replay-safe material only. Not final CandidateEvaluationResult fingerprint
 * (Phase 1C-C). Not exported from optimizer/index.js.
 */

import {
  CORE10_COMPARATOR_VERSION,
  CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
  CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION,
  CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION,
} from "../constants/versions.js";
import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import { isPlainObject } from "../deterministic/canonicalize.js";
import { fingerprintValue } from "../deterministic/fingerprint.js";
import { domainValueKey } from "../contracts/shared.js";
import { isConstraintEvaluationPort } from "../ports/constraintEvaluationPort.js";

const FAIL =
  CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT_FINGERPRINT;

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
 * @param {string} field
 * @returns {string}
 */
function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be a non-empty string`,
      { field }
    );
  }
  return value;
}

/**
 * @param {unknown} registry
 * @returns {string}
 */
function readRegistryDescriptorFingerprint(registry) {
  if (
    registry == null ||
    typeof registry !== "object" ||
    Array.isArray(registry)
  ) {
    throw new OptimizerContractError(
      FAIL,
      "objectiveRegistry must be a Phase 1C-A registry API object",
      {}
    );
  }
  const fn = ownValue(/** @type {object} */ (registry), "descriptorFingerprint");
  if (typeof fn !== "function") {
    throw new OptimizerContractError(
      FAIL,
      "objectiveRegistry.descriptorFingerprint must be a function",
      {}
    );
  }
  const fp = fn.call(registry);
  if (typeof fp !== "string" || fp.trim() === "") {
    throw new OptimizerContractError(
      FAIL,
      "objectiveRegistry.descriptorFingerprint() must return a non-empty string",
      {}
    );
  }
  return fp;
}

/**
 * Build canonical fingerprint material (no functions / runtime identity).
 * Decision variables are ordered by variableId for replay stability.
 * Assignments are ordered by variableId (canonical CandidateEvaluationInput order).
 * Snapshot refs preserve validated context.snapshotRefs order
 * (OptimizationContext insertion order — no second sort by snapshotId).
 * objectiveExecutionSpecs and authorityValues preserve input order.
 *
 * @param {object} input
 * @param {object} objectiveRegistry
 * @param {object} constraintEvaluationPort
 * @returns {object}
 */
function buildCandidateEvaluationInputFingerprintMaterial(
  input,
  objectiveRegistry,
  constraintEvaluationPort
) {
  if (!isPlainObject(input)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationInput must be a plain object",
      {}
    );
  }

  if (!isConstraintEvaluationPort(constraintEvaluationPort)) {
    throw new OptimizerContractError(
      FAIL,
      "constraintEvaluationPort must be a frozen Phase 1C-B1 port wrapper",
      {}
    );
  }

  const request = ownValue(input, "request");
  const context = ownValue(input, "context");
  const candidate = ownValue(input, "candidate");
  if (!isPlainObject(request) || !isPlainObject(context) || !isPlainObject(candidate)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationInput request/context/candidate must be plain objects",
      {}
    );
  }

  const operationRaw = ownValue(request, "operation");
  const operationId =
    isPlainObject(operationRaw) &&
    typeof ownValue(/** @type {object} */ (operationRaw), "operationId") ===
      "string"
      ? ownValue(/** @type {object} */ (operationRaw), "operationId")
      : ownValue(candidate, "operation");

  const snapshotRefsRaw = ownValue(context, "snapshotRefs");
  if (!Array.isArray(snapshotRefsRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "context.snapshotRefs must be an array",
      {}
    );
  }
  const snapshotRefs = snapshotRefsRaw.map((ref, i) => {
    if (!isPlainObject(ref)) {
      throw new OptimizerContractError(
        FAIL,
        `context.snapshotRefs[${i}] must be a plain object`,
        { index: i }
      );
    }
    return {
      snapshotId: requireNonEmptyString(
        ownValue(/** @type {object} */ (ref), "snapshotId"),
        `snapshotRefs[${i}].snapshotId`
      ),
      snapshotVersion: requireNonEmptyString(
        ownValue(/** @type {object} */ (ref), "snapshotVersion"),
        `snapshotRefs[${i}].snapshotVersion`
      ),
      fingerprint: requireNonEmptyString(
        ownValue(/** @type {object} */ (ref), "fingerprint"),
        `snapshotRefs[${i}].fingerprint`
      ),
    };
  });

  const assignmentsRaw = ownValue(/** @type {object} */ (candidate), "assignments");
  if (!Array.isArray(assignmentsRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "candidate.assignments must be an array",
      {}
    );
  }
  const assignments = assignmentsRaw.map((item, i) => {
    if (!isPlainObject(item)) {
      throw new OptimizerContractError(
        FAIL,
        `candidate.assignments[${i}] must be a plain object`,
        { index: i }
      );
    }
    return {
      variableId: requireNonEmptyString(
        ownValue(/** @type {object} */ (item), "variableId"),
        `assignments[${i}].variableId`
      ),
      valueId: requireNonEmptyString(
        ownValue(/** @type {object} */ (item), "valueId"),
        `assignments[${i}].valueId`
      ),
    };
  });
  // Canonicalize assignment order (matches CandidateEvaluationInput semantics).
  assignments.sort((a, b) =>
    compareStableString(a.variableId, b.variableId)
  );

  const decisionVariablesRaw = ownValue(input, "decisionVariables");
  if (!Array.isArray(decisionVariablesRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "decisionVariables must be an array",
      {}
    );
  }
  /** @type {object[]} */
  const decisionVariables = decisionVariablesRaw.map((dv, i) => {
    if (!isPlainObject(dv)) {
      throw new OptimizerContractError(
        FAIL,
        `decisionVariables[${i}] must be a plain object`,
        { index: i }
      );
    }
    const domainRaw = ownValue(/** @type {object} */ (dv), "domain");
    if (!Array.isArray(domainRaw)) {
      throw new OptimizerContractError(
        FAIL,
        `decisionVariables[${i}].domain must be an array`,
        { index: i }
      );
    }
    return {
      variableId: requireNonEmptyString(
        ownValue(/** @type {object} */ (dv), "variableId"),
        `decisionVariables[${i}].variableId`
      ),
      required: ownValue(/** @type {object} */ (dv), "required") === true,
      domain: domainRaw.map((v) => domainValueKey(v)),
    };
  });
  decisionVariables.sort((a, b) =>
    compareStableString(a.variableId, b.variableId)
  );

  const specsRaw = ownValue(input, "objectiveExecutionSpecs");
  if (!Array.isArray(specsRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "objectiveExecutionSpecs must be an array",
      {}
    );
  }
  // Preserve execution order — do not sort.
  const objectiveExecutionSpecs = specsRaw.map((spec, i) => {
    if (!isPlainObject(spec)) {
      throw new OptimizerContractError(
        FAIL,
        `objectiveExecutionSpecs[${i}] must be a plain object`,
        { index: i }
      );
    }
    return {
      objectiveId: requireNonEmptyString(
        ownValue(/** @type {object} */ (spec), "objectiveId"),
        `objectiveExecutionSpecs[${i}].objectiveId`
      ),
      objectiveVersion: requireNonEmptyString(
        ownValue(/** @type {object} */ (spec), "objectiveVersion"),
        `objectiveExecutionSpecs[${i}].objectiveVersion`
      ),
      weight: ownValue(/** @type {object} */ (spec), "weight"),
      quantizeScale: ownValue(/** @type {object} */ (spec), "quantizeScale"),
    };
  });

  const authorityRaw = ownValue(input, "authorityValues");
  if (!Array.isArray(authorityRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "authorityValues must be an array",
      {}
    );
  }
  const authorityValues = authorityRaw.slice();

  return {
    inputFingerprintVersion: CORE10_CANDIDATE_INPUT_FINGERPRINT_VERSION,
    pipelineVersion: CORE10_CANDIDATE_EVALUATION_PIPELINE_VERSION,
    scoreCompositionVersion: CORE10_CANDIDATE_SCORE_COMPOSITION_VERSION,
    schemaVersion: requireNonEmptyString(
      ownValue(input, "schemaVersion"),
      "schemaVersion"
    ),
    evaluationVersion: requireNonEmptyString(
      ownValue(input, "evaluationVersion"),
      "evaluationVersion"
    ),
    requestId: requireNonEmptyString(
      ownValue(/** @type {object} */ (request), "requestId"),
      "request.requestId"
    ),
    tenantId: requireNonEmptyString(
      ownValue(/** @type {object} */ (request), "tenantId"),
      "request.tenantId"
    ),
    competitionId: requireNonEmptyString(
      ownValue(/** @type {object} */ (request), "competitionId"),
      "request.competitionId"
    ),
    operation: requireNonEmptyString(operationId, "operation"),
    snapshotRefs,
    candidateId: requireNonEmptyString(
      ownValue(/** @type {object} */ (candidate), "candidateId"),
      "candidate.candidateId"
    ),
    assignments,
    decisionVariables,
    objectiveExecutionSpecs,
    objectiveRegistryDescriptorFingerprint:
      readRegistryDescriptorFingerprint(objectiveRegistry),
    constraintPortId: requireNonEmptyString(
      ownValue(/** @type {object} */ (constraintEvaluationPort), "portId"),
      "constraintEvaluationPort.portId"
    ),
    constraintPortVersion: requireNonEmptyString(
      ownValue(/** @type {object} */ (constraintEvaluationPort), "portVersion"),
      "constraintEvaluationPort.portVersion"
    ),
    authorityValues,
    comparatorVersion: CORE10_COMPARATOR_VERSION,
  };
}

/**
 * Fingerprint validated CandidateEvaluationInput + registry/port descriptors.
 *
 * @param {object} args
 * @param {object} args.input
 * @param {object} args.objectiveRegistry
 * @param {object} args.constraintEvaluationPort
 * @returns {string}
 */
export function createCandidateEvaluationInputFingerprint({
  input,
  objectiveRegistry,
  constraintEvaluationPort,
} = {}) {
  const material = buildCandidateEvaluationInputFingerprintMaterial(
    input,
    objectiveRegistry,
    constraintEvaluationPort
  );
  return fingerprintValue(material);
}
