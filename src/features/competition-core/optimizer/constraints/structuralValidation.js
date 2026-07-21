/**
 * CORE-10 — structural validation only (not CORE-01 business rules).
 */

import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createOptimizationRequest } from "../contracts/optimizationRequest.js";
import { createCandidateSolution } from "../contracts/candidateSolution.js";
import { domainValueKey } from "../contracts/shared.js";
import { serializeCanonical } from "../deterministic/fingerprint.js";

/**
 * @typedef {Object} StructuralIssue
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @param {unknown} input
 * @returns {{ ok: true, request: object } | { ok: false, issues: StructuralIssue[] }}
 */
export function validateOptimizationRequestStructure(input) {
  try {
    const request = createOptimizationRequest(input);
    return { ok: true, request };
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      return {
        ok: false,
        issues: [
          {
            code: err.code,
            message: err.message,
            details: err.details || {},
          },
        ],
      };
    }
    throw err;
  }
}

/**
 * Validate tenant / competition scope consistency (also enforced in factory).
 * @param {object} request
 * @returns {StructuralIssue[]}
 */
export function validateScopeConsistency(request) {
  /** @type {StructuralIssue[]} */
  const issues = [];
  if (!request?.tenantId || !request?.context?.tenantId) {
    issues.push({
      code: OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      message: "tenantId missing on request or context",
      details: {},
    });
  } else if (request.tenantId !== request.context.tenantId) {
    issues.push({
      code: OPTIMIZATION_FAILURE_CODE.TENANT_SCOPE_MISMATCH,
      message: "tenantId mismatch between request and context",
      details: {
        requestTenantId: request.tenantId,
        contextTenantId: request.context.tenantId,
      },
    });
  }

  if (!request?.competitionId || !request?.context?.competitionId) {
    issues.push({
      code: OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      message: "competitionId missing on request or context",
      details: {},
    });
  } else if (request.competitionId !== request.context.competitionId) {
    issues.push({
      code: OPTIMIZATION_FAILURE_CODE.COMPETITION_SCOPE_MISMATCH,
      message: "competitionId mismatch between request and context",
      details: {
        requestCompetitionId: request.competitionId,
        contextCompetitionId: request.context.competitionId,
      },
    });
  }
  return issues;
}

/**
 * Snapshot refs must include version + fingerprint (structural only).
 * @param {object} context
 * @returns {StructuralIssue[]}
 */
export function validateSnapshotReferences(context) {
  /** @type {StructuralIssue[]} */
  const issues = [];
  const refs = context?.snapshotRefs;
  if (!Array.isArray(refs) || refs.length === 0) {
    issues.push({
      code: OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT,
      message: "snapshotRefs required",
      details: {},
    });
    return issues;
  }
  for (let i = 0; i < refs.length; i += 1) {
    const ref = refs[i];
    if (!ref?.snapshotId || !ref?.snapshotVersion) {
      issues.push({
        code: OPTIMIZATION_FAILURE_CODE.INVALID_CONTEXT,
        message: `snapshotRefs[${i}] missing snapshotId or snapshotVersion`,
        details: { index: i },
      });
    }
    if (!ref?.fingerprint) {
      issues.push({
        code: OPTIMIZATION_FAILURE_CODE.SNAPSHOT_FINGERPRINT_MISMATCH,
        message: `snapshotRefs[${i}] missing fingerprint`,
        details: { index: i },
      });
    }
  }
  return issues;
}

/**
 * Candidate assignments must lie inside declared decision domains.
 * @param {object} candidateInput
 * @param {readonly object[]} decisionVariables
 * @returns {{ ok: true, candidate: object } | { ok: false, issues: StructuralIssue[] }}
 */
export function validateCandidateAgainstDomains(candidateInput, decisionVariables) {
  /** @type {StructuralIssue[]} */
  const issues = [];
  let candidate;
  try {
    candidate = createCandidateSolution(candidateInput);
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      return {
        ok: false,
        issues: [
          {
            code: err.code,
            message: err.message,
            details: err.details || {},
          },
        ],
      };
    }
    throw err;
  }

  /** @type {Map<string, Set<string>>} */
  const domainByVar = new Map();
  for (const dv of decisionVariables || []) {
    domainByVar.set(
      dv.variableId,
      new Set((dv.domain || []).map((v) => domainValueKey(v)))
    );
  }

  for (const [variableId, value] of Object.entries(candidate.assignments)) {
    const domain = domainByVar.get(variableId);
    if (!domain) {
      issues.push({
        code: OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
        message: `Assignment references unknown variableId: ${variableId}`,
        details: { variableId },
      });
      continue;
    }
    const key = domainValueKey(value);
    if (!domain.has(key)) {
      issues.push({
        code: OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
        message: `Assignment for ${variableId} is outside declared domain`,
        details: { variableId, value },
      });
    }
  }

  for (const dv of decisionVariables || []) {
    if (dv.required && !Object.prototype.hasOwnProperty.call(candidate.assignments, dv.variableId)) {
      issues.push({
        code: OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
        message: `Missing required assignment for ${dv.variableId}`,
        details: { variableId: dv.variableId },
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, candidate };
}

/**
 * Canonical replay-input validity: must serialize without non-canonical values.
 * @param {unknown} value
 * @returns {StructuralIssue[]}
 */
export function validateCanonicalReplayInput(value) {
  try {
    serializeCanonical(value);
    return [];
  } catch (err) {
    if (err instanceof OptimizerContractError) {
      return [
        {
          code: err.code,
          message: err.message,
          details: err.details || {},
        },
      ];
    }
    throw err;
  }
}

/**
 * Full structural validation of a request payload.
 * @param {unknown} input
 * @returns {{ ok: true, request: object } | { ok: false, issues: StructuralIssue[] }}
 */
export function validateOptimizationRequest(input) {
  const base = validateOptimizationRequestStructure(input);
  if (!base.ok) return base;

  const issues = [
    ...validateScopeConsistency(base.request),
    ...validateSnapshotReferences(base.request.context),
    ...validateCanonicalReplayInput(base.request),
  ];

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return base;
}
