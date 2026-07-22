/**
 * CORE-10 Phase 1C-B1 — CandidateEvaluationInput (replay-safe).
 * Does not use Phase 1B CandidateSolution (which already carries feasibility/score).
 * Assignments are { variableId, valueId } records; canonical order by variableId.
 * Every declared DecisionVariable must receive exactly one assignment.
 * Own-property reads only for required fields.
 */

import {
  CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
  CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
} from "../constants/versions.js";
import { CANDIDATE_EVALUATION_FAILURE_CODE } from "../enums/candidateEvaluationFailureCodes.js";
import { isOptimizationOperation } from "../enums/optimizationOperation.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { compareStableString } from "../deterministic/compare.js";
import {
  deepFreezeCanonical,
  isPlainObject,
} from "../deterministic/canonicalize.js";
import { createOptimizationRequest } from "./optimizationRequest.js";
import { createOptimizationContext } from "./optimizationContext.js";
import { createDecisionVariable } from "./decisionVariable.js";
import { createObjectiveExecutionSpec } from "./objectiveExecutionSpec.js";
import { domainValueKey, rejectUnknownFields, requireStableId } from "./shared.js";

const INPUT_ALLOWED = Object.freeze([
  "request",
  "context",
  "candidate",
  "decisionVariables",
  "objectiveExecutionSpecs",
  "authorityValues",
  "schemaVersion",
  "evaluationVersion",
]);

const CANDIDATE_ALLOWED = Object.freeze([
  "candidateId",
  "operation",
  "assignments",
]);

const ASSIGNMENT_ALLOWED = Object.freeze(["variableId", "valueId"]);

const FAIL = CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_CANDIDATE_INPUT;

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
 * Phase 1C-B1 assignment valueId is a stable string domain member.
 * @param {readonly (string|number|boolean|null)[]} domain
 * @param {string} valueId
 * @returns {boolean}
 */
function domainContainsValueId(domain, valueId) {
  for (let i = 0; i < domain.length; i += 1) {
    const entry = domain[i];
    if (typeof entry === "string" && entry === valueId) {
      return true;
    }
  }
  return false;
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
 * Copy assignments, reject duplicate variableIds, sort by variableId.
 * Caller array is never mutated.
 * @param {unknown} assignments
 * @returns {{ variableId: string, valueId: string }[]}
 */
function normalizeAssignments(assignments) {
  if (!Array.isArray(assignments)) {
    throw new OptimizerContractError(
      FAIL,
      "candidate.assignments must be an array",
      {}
    );
  }
  const source = assignments.slice();
  /** @type {{ variableId: string, valueId: string }[]} */
  const out = [];
  const seenVars = new Set();
  for (let i = 0; i < source.length; i += 1) {
    const record = createAssignmentRecord(
      source[i],
      `candidate.assignments[${i}]`
    );
    if (seenVars.has(record.variableId)) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.DUPLICATE_ASSIGNMENT,
        `Duplicate assignment for variableId: ${record.variableId}`,
        { variableId: record.variableId, index: i }
      );
    }
    seenVars.add(record.variableId);
    out.push(record);
  }
  out.sort((a, b) => compareStableString(a.variableId, b.variableId));
  return out;
}

/**
 * @param {readonly object[]} left
 * @param {readonly object[]} right
 * @returns {boolean}
 */
function decisionVariablesMatch(left, right) {
  if (left.length !== right.length) return false;
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const dv of left) {
    byId.set(dv.variableId, dv);
  }
  for (const dv of right) {
    const other = byId.get(dv.variableId);
    if (!other) return false;
    if (other.required !== dv.required) return false;
    if (other.domain.length !== dv.domain.length) return false;
    const leftKeys = new Set(other.domain.map((v) => domainValueKey(v)));
    for (const v of dv.domain) {
      if (!leftKeys.has(domainValueKey(v))) return false;
    }
  }
  return true;
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createCandidateEvaluationInput(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationInput must be a plain object",
      {}
    );
  }

  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    INPUT_ALLOWED,
    "CandidateEvaluationInput",
    FAIL
  );

  const schemaVersion = requireStableId(
    ownValue(partial, "schemaVersion") ??
      CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
    "CandidateEvaluationInput.schemaVersion",
    FAIL
  );
  if (schemaVersion !== CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION) {
    throw new OptimizerContractError(
      FAIL,
      `Unsupported CandidateEvaluationInput.schemaVersion: ${schemaVersion}`,
      {
        schemaVersion,
        expected: CORE10_CANDIDATE_EVALUATION_INPUT_SCHEMA_VERSION,
      }
    );
  }

  const evaluationVersion = requireStableId(
    ownValue(partial, "evaluationVersion") ??
      CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
    "CandidateEvaluationInput.evaluationVersion",
    FAIL
  );
  if (evaluationVersion !== CORE10_HARD_VIOLATION_COMPOSITION_VERSION) {
    throw new OptimizerContractError(
      FAIL,
      `Unsupported CandidateEvaluationInput.evaluationVersion: ${evaluationVersion}`,
      {
        evaluationVersion,
        expected: CORE10_HARD_VIOLATION_COMPOSITION_VERSION,
      }
    );
  }

  const requestRaw = ownValue(partial, "request");
  if (!requestRaw || typeof requestRaw !== "object" || Array.isArray(requestRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationInput.request is required",
      {}
    );
  }

  let request;
  try {
    request = createOptimizationRequest(
      /** @type {object} */ ({ .../** @type {object} */ (requestRaw) })
    );
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      if (
        err.code === "TENANT_SCOPE_MISMATCH" ||
        err.code === CANDIDATE_EVALUATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH
      ) {
        throw new OptimizerContractError(
          CANDIDATE_EVALUATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH,
          err.message,
          err.details || {}
        );
      }
      if (
        err.code === "COMPETITION_SCOPE_MISMATCH" ||
        err.code ===
          CANDIDATE_EVALUATION_FAILURE_CODE.COMPETITION_SCOPE_MISMATCH
      ) {
        throw new OptimizerContractError(
          CANDIDATE_EVALUATION_FAILURE_CODE.COMPETITION_SCOPE_MISMATCH,
          err.message,
          err.details || {}
        );
      }
      if (
        err.code === "SNAPSHOT_FINGERPRINT_MISMATCH" ||
        err.code === "INVALID_CONTEXT"
      ) {
        throw new OptimizerContractError(
          CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_SNAPSHOT_BINDING,
          err.message,
          err.details || {}
        );
      }
      throw new OptimizerContractError(FAIL, err.message, err.details || {});
    }
    throw err;
  }

  const contextRaw = ownValue(partial, "context");
  if (!contextRaw || typeof contextRaw !== "object" || Array.isArray(contextRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationInput.context is required",
      {}
    );
  }

  let context;
  try {
    context = createOptimizationContext(
      /** @type {object} */ ({ .../** @type {object} */ (contextRaw) })
    );
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      if (
        err.code === "SNAPSHOT_FINGERPRINT_MISMATCH" ||
        err.code === "INVALID_CONTEXT"
      ) {
        throw new OptimizerContractError(
          CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_SNAPSHOT_BINDING,
          err.message,
          err.details || {}
        );
      }
      throw new OptimizerContractError(FAIL, err.message, err.details || {});
    }
    throw err;
  }

  if (request.tenantId !== context.tenantId) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH,
      "request.tenantId must equal context.tenantId",
      {
        requestTenantId: request.tenantId,
        contextTenantId: context.tenantId,
      }
    );
  }
  if (request.competitionId !== context.competitionId) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.COMPETITION_SCOPE_MISMATCH,
      "request.competitionId must equal context.competitionId",
      {
        requestCompetitionId: request.competitionId,
        contextCompetitionId: context.competitionId,
      }
    );
  }

  for (let i = 0; i < context.snapshotRefs.length; i += 1) {
    const ref = context.snapshotRefs[i];
    if (!ref.snapshotId || !ref.snapshotVersion || !ref.fingerprint) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.INVALID_SNAPSHOT_BINDING,
        `context.snapshotRefs[${i}] missing required binding fields`,
        { index: i }
      );
    }
  }

  const decisionVariablesRaw = ownValue(partial, "decisionVariables");
  if (!Array.isArray(decisionVariablesRaw) || decisionVariablesRaw.length === 0) {
    throw new OptimizerContractError(
      FAIL,
      "decisionVariables must be a non-empty array",
      {}
    );
  }

  const seenVars = new Set();
  /** @type {object[]} */
  const decisionVariables = [];
  for (let i = 0; i < decisionVariablesRaw.length; i += 1) {
    const dvRaw = decisionVariablesRaw[i];
    if (!dvRaw || typeof dvRaw !== "object" || Array.isArray(dvRaw)) {
      throw new OptimizerContractError(
        FAIL,
        `decisionVariables[${i}] must be an object`,
        { index: i }
      );
    }
    let created;
    try {
      created = createDecisionVariable({
        .../** @type {object} */ (dvRaw),
      });
    } catch (err) {
      if (err instanceof OptimizerContractError) {
        throw new OptimizerContractError(FAIL, err.message, err.details || {});
      }
      throw err;
    }
    if (seenVars.has(created.variableId)) {
      throw new OptimizerContractError(
        FAIL,
        `Duplicate decision variableId: ${created.variableId}`,
        { variableId: created.variableId }
      );
    }
    seenVars.add(created.variableId);
    decisionVariables.push(created);
  }

  if (!decisionVariablesMatch(decisionVariables, request.decisionVariables)) {
    throw new OptimizerContractError(
      FAIL,
      "decisionVariables must match request.decisionVariables",
      {}
    );
  }

  const candidateRaw = ownValue(partial, "candidate");
  if (!candidateRaw || typeof candidateRaw !== "object" || Array.isArray(candidateRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationInput.candidate is required",
      {}
    );
  }
  if (!isPlainObject(candidateRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "CandidateEvaluationInput.candidate must be a plain object",
      {}
    );
  }
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (candidateRaw),
    CANDIDATE_ALLOWED,
    "CandidateEvaluationInput.candidate",
    FAIL
  );

  const candidateId = requireStableId(
    ownValue(/** @type {object} */ (candidateRaw), "candidateId"),
    "candidate.candidateId",
    FAIL
  );

  const operation = requireStableId(
    ownValue(/** @type {object} */ (candidateRaw), "operation"),
    "candidate.operation",
    FAIL
  );
  if (!isOptimizationOperation(operation)) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.OPERATION_MISMATCH,
      "candidate.operation is not a supported optimization operation",
      { candidateOperation: operation }
    );
  }
  if (operation !== request.operation.operationId) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.OPERATION_MISMATCH,
      "candidate.operation must match request.operation.operationId",
      {
        candidateOperation: operation,
        requestOperation: request.operation.operationId,
      }
    );
  }

  const assignments = normalizeAssignments(
    ownValue(/** @type {object} */ (candidateRaw), "assignments")
  );

  /** @type {Map<string, object>} */
  const domainByVar = new Map();
  for (const dv of decisionVariables) {
    domainByVar.set(dv.variableId, dv);
  }

  for (const assignment of assignments) {
    const dv = domainByVar.get(assignment.variableId);
    if (!dv) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.UNKNOWN_DECISION_VARIABLE,
        `Assignment references unknown variableId: ${assignment.variableId}`,
        { variableId: assignment.variableId }
      );
    }
    if (!domainContainsValueId(dv.domain, assignment.valueId)) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.ASSIGNMENT_OUTSIDE_DOMAIN,
        `Assignment for ${assignment.variableId} is outside declared domain`,
        {
          variableId: assignment.variableId,
          valueId: assignment.valueId,
        }
      );
    }
  }

  // Exactly one assignment for every declared DecisionVariable (not only required).
  const assignedIds = new Set(assignments.map((a) => a.variableId));
  for (const dv of decisionVariables) {
    if (!assignedIds.has(dv.variableId)) {
      throw new OptimizerContractError(
        CANDIDATE_EVALUATION_FAILURE_CODE.MISSING_ASSIGNMENT,
        `Missing assignment for ${dv.variableId}`,
        { variableId: dv.variableId }
      );
    }
  }
  if (assignments.length !== decisionVariables.length) {
    throw new OptimizerContractError(
      CANDIDATE_EVALUATION_FAILURE_CODE.UNKNOWN_DECISION_VARIABLE,
      "Assignment count must equal decisionVariables count",
      {
        assignmentCount: assignments.length,
        decisionVariableCount: decisionVariables.length,
      }
    );
  }

  const specsRaw = ownValue(partial, "objectiveExecutionSpecs");
  if (!Array.isArray(specsRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "objectiveExecutionSpecs must be an array",
      {}
    );
  }
  // Preserve caller-supplied order — copy, never sort.
  const objectiveExecutionSpecs = specsRaw.map((spec, i) => {
    try {
      return createObjectiveExecutionSpec(
        spec && typeof spec === "object"
          ? { .../** @type {object} */ (spec) }
          : {}
      );
    } catch (err) {
      if (err instanceof OptimizerContractError) {
        throw new OptimizerContractError(
          FAIL,
          `objectiveExecutionSpecs[${i}]: ${err.message}`,
          { index: i, ...(err.details || {}) }
        );
      }
      throw err;
    }
  });

  const authorityRaw = ownValue(partial, "authorityValues");
  if (!Array.isArray(authorityRaw)) {
    throw new OptimizerContractError(
      FAIL,
      "authorityValues must be an array of safe integers",
      {}
    );
  }
  const authorityValues = authorityRaw.map((v, i) =>
    requireSafeInt(v, `authorityValues[${i}]`)
  );
  if (authorityValues.length !== request.policy.authorityKeys.length) {
    throw new OptimizerContractError(
      FAIL,
      "authorityValues length must equal policy.authorityKeys length",
      {
        authorityValuesLength: authorityValues.length,
        authorityKeysLength: request.policy.authorityKeys.length,
      }
    );
  }

  return /** @type {Readonly<object>} */ (
    deepFreezeCanonical(
      {
        schemaVersion,
        evaluationVersion,
        request,
        context,
        candidate: {
          candidateId,
          operation,
          assignments,
        },
        decisionVariables,
        objectiveExecutionSpecs,
        authorityValues,
      },
      "CandidateEvaluationInput"
    )
  );
}
