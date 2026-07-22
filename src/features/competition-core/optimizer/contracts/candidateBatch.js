/**
 * CORE-10 Phase 1H — Candidate Batch contract (unevaluated supplied batch).
 *
 * Formalizes the existing supplied-candidate batch shape used by Phase 1F/1G
 * orchestration. Does not evaluate, rank, generate, or search.
 * Does not reorder candidates (orchestration owns candidateId canonicalization).
 */

import { CANDIDATE_RANKING_FAILURE_CODE } from "../enums/candidateRankingFailureCodes.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import {
  deepFreezeCanonical,
  isPlainObject,
} from "../deterministic/canonicalize.js";
import { rejectUnknownFields, requireStableId } from "./shared.js";

const FAIL = OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST;
const DUP = CANDIDATE_RANKING_FAILURE_CODE.DUPLICATE_CANDIDATE_ID;

const BATCH_ALLOWED = Object.freeze([
  "candidates",
  "decisionVariables",
  "objectiveExecutionSpecs",
  "authorityValues",
  "context",
]);

const CANDIDATE_ALLOWED = Object.freeze(["candidateId", "assignments"]);

const ASSIGNMENT_ALLOWED = Object.freeze(["variableId", "valueId"]);

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
 * @param {string} path
 * @returns {{ variableId: string, valueId: string }}
 */
function createAssignmentRecord(raw, path) {
  if (!isPlainObject(raw)) {
    throw new OptimizerContractError(
      FAIL,
      `${path} must be a plain object`,
      { path }
    );
  }
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (raw),
    ASSIGNMENT_ALLOWED,
    path,
    FAIL
  );
  return {
    variableId: requireStableId(
      ownValue(/** @type {object} */ (raw), "variableId"),
      `${path}.variableId`,
      FAIL
    ),
    valueId: requireStableId(
      ownValue(/** @type {object} */ (raw), "valueId"),
      `${path}.valueId`,
      FAIL
    ),
  };
}

/**
 * Clone assignment array without reordering. Caller array is never mutated.
 * @param {unknown} assignments
 * @param {string} path
 * @returns {{ variableId: string, valueId: string }[]}
 */
function cloneAssignments(assignments, path) {
  if (!Array.isArray(assignments)) {
    throw new OptimizerContractError(
      FAIL,
      `${path} must be an array`,
      { path }
    );
  }
  const source = assignments.slice();
  /** @type {{ variableId: string, valueId: string }[]} */
  const out = [];
  for (let i = 0; i < source.length; i += 1) {
    out.push(createAssignmentRecord(source[i], `${path}[${i}]`));
  }
  return out;
}

/**
 * Phase 1F-compatible structural clone — full DecisionVariable factory
 * validation remains at evaluation time.
 * @param {unknown} raw
 * @returns {unknown}
 */
function cloneDecisionVariable(raw) {
  if (!isPlainObject(raw)) return raw;
  const domainRaw = ownValue(/** @type {object} */ (raw), "domain");
  return {
    variableId: ownValue(/** @type {object} */ (raw), "variableId"),
    domain: Array.isArray(domainRaw) ? domainRaw.slice() : domainRaw,
    required: ownValue(/** @type {object} */ (raw), "required"),
  };
}

/**
 * @param {unknown} raw
 * @returns {unknown}
 */
function cloneObjectiveExecutionSpec(raw) {
  if (!isPlainObject(raw)) return raw;
  return { .../** @type {object} */ (raw) };
}

/**
 * Shallow structural clone of optional batch context.
 * @param {unknown} contextRaw
 * @returns {object}
 */
function cloneContext(contextRaw) {
  if (
    contextRaw === undefined ||
    contextRaw === null ||
    !isPlainObject(contextRaw)
  ) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateBatch.context must be a plain object when provided",
      {}
    );
  }
  const snapshotRefsRaw = ownValue(
    /** @type {object} */ (contextRaw),
    "snapshotRefs"
  );
  const metadataRaw = ownValue(/** @type {object} */ (contextRaw), "metadata");
  return {
    tenantId: ownValue(/** @type {object} */ (contextRaw), "tenantId"),
    competitionId: ownValue(
      /** @type {object} */ (contextRaw),
      "competitionId"
    ),
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

/**
 * Create an immutable Candidate Batch (unevaluated supplied-candidate shape).
 *
 * @param {object} [partial]
 * @returns {Readonly<{
 *   candidates: ReadonlyArray<Readonly<{
 *     candidateId: string,
 *     assignments: ReadonlyArray<Readonly<{
 *       variableId: string,
 *       valueId: string,
 *     }>>,
 *   }>>,
 *   decisionVariables: ReadonlyArray<unknown>,
 *   objectiveExecutionSpecs: ReadonlyArray<unknown>,
 *   authorityValues: ReadonlyArray<unknown>,
 *   context?: Readonly<object>,
 * }>}
 */
export function createCandidateBatch(partial = {}) {
  if (isThenable(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateBatch must not be a Promise/thenable",
      {}
    );
  }
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateBatch must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    BATCH_ALLOWED,
    "CandidateBatch",
    FAIL
  );

  const candidatesRaw = ownValue(partial, "candidates");
  if (!Array.isArray(candidatesRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateBatch.candidates must be an array",
      {}
    );
  }

  const decisionVariablesRaw = ownValue(partial, "decisionVariables");
  if (!Array.isArray(decisionVariablesRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateBatch.decisionVariables must be an array",
      {}
    );
  }

  const objectiveExecutionSpecsRaw = ownValue(
    partial,
    "objectiveExecutionSpecs"
  );
  if (!Array.isArray(objectiveExecutionSpecsRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateBatch.objectiveExecutionSpecs must be an array",
      {}
    );
  }

  const authorityValuesRaw = ownValue(partial, "authorityValues");
  if (!Array.isArray(authorityValuesRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateBatch.authorityValues must be an array",
      {}
    );
  }

  const candidatesSource = candidatesRaw.slice();
  /** @type {Array<{ candidateId: string, assignments: { variableId: string, valueId: string }[] }>} */
  const candidates = [];
  const seenIds = new Set();
  for (let i = 0; i < candidatesSource.length; i += 1) {
    const item = candidatesSource[i];
    if (!isPlainObject(item)) {
      throw new OptimizerContractError(
        FAIL,
        `CandidateBatch.candidates[${i}] must be a plain object`,
        { index: i }
      );
    }
    rejectUnknownFields(
      /** @type {Record<string, unknown>} */ (item),
      CANDIDATE_ALLOWED,
      `CandidateBatch.candidates[${i}]`,
      FAIL
    );
    const candidateId = requireStableId(
      ownValue(/** @type {object} */ (item), "candidateId"),
      `CandidateBatch.candidates[${i}].candidateId`,
      FAIL
    );
    if (seenIds.has(candidateId)) {
      throw new OptimizerContractError(
        DUP,
        `Duplicate candidateId in CandidateBatch: ${candidateId}`,
        { candidateId, index: i }
      );
    }
    seenIds.add(candidateId);
    candidates.push({
      candidateId,
      assignments: cloneAssignments(
        ownValue(/** @type {object} */ (item), "assignments"),
        `CandidateBatch.candidates[${i}].assignments`
      ),
    });
  }

  /** @type {Record<string, unknown>} */
  const owned = {
    candidates,
    decisionVariables: decisionVariablesRaw.map((dv) =>
      cloneDecisionVariable(dv)
    ),
    objectiveExecutionSpecs: objectiveExecutionSpecsRaw.map((spec) =>
      cloneObjectiveExecutionSpec(spec)
    ),
    authorityValues: authorityValuesRaw.slice(),
  };

  if (Object.prototype.hasOwnProperty.call(partial, "context")) {
    owned.context = cloneContext(ownValue(partial, "context"));
  }

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(owned, "CandidateBatch")
  );
}
