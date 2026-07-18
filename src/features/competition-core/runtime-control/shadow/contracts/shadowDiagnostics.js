/**
 * Shadow diagnostics pure-data contract (Phase 3A.2).
 * No console / DB / analytics side effects.
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";
import { createShadowEligibility } from "./shadowEligibility.js";
import { createShadowExecutionPlan } from "./shadowExecutionPlan.js";

/**
 * @typedef {Object} ShadowDiagnostics
 * @property {string} correlationId
 * @property {string|null} competitionId
 * @property {string} capability
 * @property {string} operation
 * @property {import('./shadowEligibility.js').ShadowEligibility} eligibility
 * @property {import('./shadowExecutionPlan.js').ShadowExecutionPlan} plan
 * @property {{ status: string|null, reasonCode: string|null, differenceCount: number }|null} comparisonSummary
 * @property {string[]} reasonCodes
 * @property {{ legacyDurationMs: number|null, canonicalDurationMs: number|null }} timings
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<ShadowDiagnostics>|null|undefined} partial
 * @returns {ShadowDiagnostics}
 */
export function createShadowDiagnostics(partial = {}) {
  const comparisonSummary = isPlainObject(partial?.comparisonSummary)
    ? {
        status:
          typeof partial.comparisonSummary.status === "string"
            ? partial.comparisonSummary.status
            : null,
        reasonCode:
          typeof partial.comparisonSummary.reasonCode === "string"
            ? partial.comparisonSummary.reasonCode
            : null,
        differenceCount:
          typeof partial.comparisonSummary.differenceCount === "number"
            ? partial.comparisonSummary.differenceCount
            : 0,
      }
    : null;

  const timingsIn = isPlainObject(partial?.timings) ? partial.timings : {};

  return {
    correlationId:
      typeof partial?.correlationId === "string" ? partial.correlationId : "",
    competitionId:
      typeof partial?.competitionId === "string" ? partial.competitionId : null,
    capability: typeof partial?.capability === "string" ? partial.capability : "",
    operation: typeof partial?.operation === "string" ? partial.operation : "",
    eligibility: createShadowEligibility(
      isPlainObject(partial?.eligibility) ? partial.eligibility : {}
    ),
    plan: createShadowExecutionPlan(
      isPlainObject(partial?.plan) ? partial.plan : {}
    ),
    comparisonSummary,
    reasonCodes: Array.isArray(partial?.reasonCodes)
      ? partial.reasonCodes.filter((c) => typeof c === "string")
      : [],
    timings: {
      legacyDurationMs:
        typeof timingsIn.legacyDurationMs === "number"
          ? timingsIn.legacyDurationMs
          : null,
      canonicalDurationMs:
        typeof timingsIn.canonicalDurationMs === "number"
          ? timingsIn.canonicalDurationMs
          : null,
    },
    metadata: isPlainObject(partial?.metadata)
      ? cloneJsonSafe(partial.metadata)
      : {},
  };
}
