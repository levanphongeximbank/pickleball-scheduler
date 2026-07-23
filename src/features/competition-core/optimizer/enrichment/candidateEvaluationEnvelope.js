/**
 * CORE-10 Phase 1L — Candidate Evaluation Envelope.
 *
 * Separates structural CandidateBatch material from evaluation-ready
 * objectiveExecutionSpecs / authorityValues. Does not evaluate, rank,
 * search, or read budgets.
 */

import { CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1 } from "../constants/versions.js";
import { OBJECTIVE_EVALUATION_FAILURE_CODE } from "../enums/objectiveEvaluationFailureCodes.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createCandidateBatch } from "../contracts/candidateBatch.js";
import { createObjectiveExecutionSpec } from "../contracts/objectiveExecutionSpec.js";
import { rejectUnknownFields, requireStableId } from "../contracts/shared.js";
import {
  deepFreezeCanonical,
  isPlainObject,
} from "../deterministic/canonicalize.js";
import { validateOptimizationRequest } from "../constraints/structuralValidation.js";

const FAIL = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST;
const DUP = OBJECTIVE_EVALUATION_FAILURE_CODE.DUPLICATE_OBJECTIVE_EXECUTION;

const ENVELOPE_ALLOWED = Object.freeze([
  "envelopeVersion",
  "objectiveExecutionSpecs",
  "authorityValues",
]);

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
 * Reject enumerable own accessors (getters/setters) per contract policy.
 *
 * @param {object} obj
 * @param {string} path
 * @param {string} [code]
 */
function rejectAccessors(obj, path, code = FAIL) {
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (
      desc &&
      (typeof desc.get === "function" || typeof desc.set === "function")
    ) {
      throw new OptimizerContractError(
        code,
        `${path}.${key} must not be an accessor`,
        { path, field: key }
      );
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requireSafeInt(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new OptimizerContractError(
      FAIL,
      `${field} must be a safe integer`,
      { field, value: value ?? null }
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

/**
 * @param {string} objectiveId
 * @param {string} objectiveVersion
 * @returns {string}
 */
function executionKey(objectiveId, objectiveVersion) {
  return `${objectiveId}\u0000${objectiveVersion}`;
}

/**
 * @param {unknown} optimizationRequest
 * @returns {Readonly<object>}
 */
function admitOptimizationRequest(optimizationRequest) {
  if (isThenable(optimizationRequest)) {
    throw new OptimizerContractError(
      FAIL,
      "optimizationRequest must not be a Promise/thenable",
      {}
    );
  }
  if (optimizationRequest === undefined || optimizationRequest === null) {
    throw new OptimizerContractError(
      FAIL,
      "optimizationRequest is required",
      { optimizationRequest: optimizationRequest ?? null }
    );
  }
  const validated = validateOptimizationRequest(optimizationRequest);
  if (!validated.ok) {
    const issue = validated.issues[0] || {
      code: FAIL,
      message: "Invalid OptimizationRequest",
      details: {},
    };
    throw new OptimizerContractError(
      issue.code,
      issue.message,
      issue.details || {}
    );
  }
  return validated.request;
}

/**
 * Admit objectiveExecutionSpecs with Phase 1C-A duplicate-identity rules.
 * Preserves caller array order. Does not execute objectives.
 *
 * @param {unknown} specsRaw
 * @param {string} path
 * @returns {object[]}
 */
function admitObjectiveExecutionSpecs(specsRaw, path) {
  if (!Array.isArray(specsRaw)) {
    throw new OptimizerContractError(
      FAIL,
      `${path} must be an array`,
      { path }
    );
  }
  const source = specsRaw.slice();
  /** @type {object[]} */
  const specs = [];
  const seen = new Set();
  for (let i = 0; i < source.length; i += 1) {
    const item = source[i];
    if (isThenable(item)) {
      throw new OptimizerContractError(
        FAIL,
        `${path}[${i}] must not be a Promise/thenable`,
        { path, index: i }
      );
    }
    if (!isPlainObject(item)) {
      throw new OptimizerContractError(
        FAIL,
        `${path}[${i}] must be a plain object`,
        { path, index: i }
      );
    }
    rejectAccessors(
      /** @type {object} */ (item),
      `${path}[${i}]`
    );
    const spec = createObjectiveExecutionSpec({
      .../** @type {object} */ (item),
    });
    const key = executionKey(spec.objectiveId, spec.objectiveVersion);
    if (seen.has(key)) {
      throw new OptimizerContractError(
        DUP,
        `Duplicate objective in ${path}: ${spec.objectiveId}@${spec.objectiveVersion}`,
        {
          objectiveId: spec.objectiveId,
          objectiveVersion: spec.objectiveVersion,
          index: i,
        }
      );
    }
    seen.add(key);
    specs.push({
      objectiveId: spec.objectiveId,
      objectiveVersion: spec.objectiveVersion,
      weight: spec.weight,
      quantizeScale: spec.quantizeScale,
    });
  }
  return specs;
}

/**
 * @param {unknown} authorityRaw
 * @param {string} path
 * @returns {number[]}
 */
function admitAuthorityValues(authorityRaw, path) {
  if (!Array.isArray(authorityRaw)) {
    throw new OptimizerContractError(
      FAIL,
      `${path} must be an array of safe integers`,
      { path }
    );
  }
  const source = authorityRaw.slice();
  /** @type {number[]} */
  const values = [];
  for (let i = 0; i < source.length; i += 1) {
    values.push(requireSafeInt(source[i], `${path}[${i}]`));
  }
  return values;
}

/**
 * Create an immutable Candidate Evaluation Envelope.
 *
 * @param {object} [partial]
 * @returns {Readonly<{
 *   envelopeVersion: string,
 *   objectiveExecutionSpecs: ReadonlyArray<object>,
 *   authorityValues: ReadonlyArray<number>,
 * }>}
 */
export function createCandidateEvaluationEnvelope(partial = {}) {
  if (isThenable(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationEnvelope must not be a Promise/thenable",
      {}
    );
  }
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationEnvelope must be a plain object",
      {}
    );
  }

  rejectAccessors(/** @type {object} */ (partial), "CandidateEvaluationEnvelope");
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ENVELOPE_ALLOWED,
    "CandidateEvaluationEnvelope",
    FAIL
  );

  const envelopeVersion = requireStableId(
    ownValue(partial, "envelopeVersion") ??
      CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1,
    "CandidateEvaluationEnvelope.envelopeVersion",
    FAIL
  );
  if (envelopeVersion !== CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1) {
    throw new OptimizerContractError(
      FAIL,
      `Unsupported CandidateEvaluationEnvelope version: ${envelopeVersion}`,
      {
        envelopeVersion,
        supported: CORE10_CANDIDATE_EVALUATION_ENVELOPE_V1,
      }
    );
  }

  if (!Object.prototype.hasOwnProperty.call(partial, "objectiveExecutionSpecs")) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationEnvelope.objectiveExecutionSpecs is required",
      {}
    );
  }
  if (!Object.prototype.hasOwnProperty.call(partial, "authorityValues")) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationEnvelope.authorityValues is required",
      {}
    );
  }

  const objectiveExecutionSpecs = admitObjectiveExecutionSpecs(
    ownValue(partial, "objectiveExecutionSpecs"),
    "CandidateEvaluationEnvelope.objectiveExecutionSpecs"
  );
  const authorityValues = admitAuthorityValues(
    ownValue(partial, "authorityValues"),
    "CandidateEvaluationEnvelope.authorityValues"
  );

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        envelopeVersion,
        objectiveExecutionSpecs,
        authorityValues,
      },
      "CandidateEvaluationEnvelope"
    )
  );
}

/**
 * Assert OptimizationRequest / envelope compatibility without evaluating.
 *
 * @param {unknown} optimizationRequest
 * @param {unknown} evaluationEnvelope
 * @returns {Readonly<{
 *   request: Readonly<object>,
 *   evaluationEnvelope: Readonly<object>,
 * }>}
 */
export function assertCandidateEvaluationEnvelopeCompatible(
  optimizationRequest,
  evaluationEnvelope
) {
  const request = admitOptimizationRequest(optimizationRequest);
  const envelope = createCandidateEvaluationEnvelope(
    /** @type {object} */ (evaluationEnvelope)
  );

  if (
    envelope.authorityValues.length !== request.policy.authorityKeys.length
  ) {
    throw new OptimizerContractError(
      FAIL,
      "authorityValues length must equal policy.authorityKeys length",
      {
        authorityValuesLength: envelope.authorityValues.length,
        authorityKeysLength: request.policy.authorityKeys.length,
      }
    );
  }

  return Object.freeze({
    request,
    evaluationEnvelope: envelope,
  });
}

/**
 * Apply envelope specs/authority onto an admitted CandidateBatch.
 * Preserves candidates, decisionVariables, candidate IDs/assignments, context.
 * Replaces only objectiveExecutionSpecs and authorityValues.
 *
 * @param {unknown} candidateBatch
 * @param {unknown} evaluationEnvelope
 * @returns {Readonly<object>}
 */
export function applyCandidateEvaluationEnvelope(
  candidateBatch,
  evaluationEnvelope
) {
  if (isThenable(candidateBatch)) {
    throw new OptimizerContractError(
      FAIL,
      "candidateBatch must not be a Promise/thenable",
      {}
    );
  }
  if (isThenable(evaluationEnvelope)) {
    throw new OptimizerContractError(
      FAIL,
      "evaluationEnvelope must not be a Promise/thenable",
      {}
    );
  }

  const admittedBatch = createCandidateBatch(
    /** @type {object} */ (candidateBatch)
  );
  const envelope = createCandidateEvaluationEnvelope(
    /** @type {object} */ (evaluationEnvelope)
  );

  /** @type {object} */
  const partial = {
    candidates: admittedBatch.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      assignments: candidate.assignments.map((assignment) => ({
        variableId: assignment.variableId,
        valueId: assignment.valueId,
      })),
    })),
    decisionVariables: admittedBatch.decisionVariables.map((dv) => {
      if (!isPlainObject(dv)) return dv;
      const domainRaw = ownValue(/** @type {object} */ (dv), "domain");
      return {
        variableId: ownValue(/** @type {object} */ (dv), "variableId"),
        domain: Array.isArray(domainRaw) ? domainRaw.slice() : domainRaw,
        required: ownValue(/** @type {object} */ (dv), "required"),
      };
    }),
    objectiveExecutionSpecs: envelope.objectiveExecutionSpecs.map((spec) => ({
      objectiveId: spec.objectiveId,
      objectiveVersion: spec.objectiveVersion,
      weight: spec.weight,
      quantizeScale: spec.quantizeScale,
    })),
    authorityValues: envelope.authorityValues.slice(),
  };

  if (Object.prototype.hasOwnProperty.call(admittedBatch, "context")) {
    const context = /** @type {object} */ (admittedBatch.context);
    const snapshotRefsRaw = ownValue(context, "snapshotRefs");
    const metadataRaw = ownValue(context, "metadata");
    partial.context = {
      tenantId: ownValue(context, "tenantId"),
      competitionId: ownValue(context, "competitionId"),
      snapshotRefs: Array.isArray(snapshotRefsRaw)
        ? snapshotRefsRaw.map((ref) =>
            ref && typeof ref === "object" && !Array.isArray(ref)
              ? {
                  snapshotId: /** @type {object} */ (ref).snapshotId,
                  snapshotVersion: /** @type {object} */ (ref).snapshotVersion,
                  fingerprint: /** @type {object} */ (ref).fingerprint,
                  kind: /** @type {object} */ (ref).kind,
                }
              : ref
          )
        : snapshotRefsRaw,
      metadata:
        metadataRaw &&
        typeof metadataRaw === "object" &&
        !Array.isArray(metadataRaw)
          ? { .../** @type {object} */ (metadataRaw) }
          : metadataRaw,
    };
  }

  return createCandidateBatch(partial);
}
