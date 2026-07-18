/**
 * Build shadow diagnostics from eligibility / plan / comparison (Phase 3A.2).
 */

import { isPlainObject } from "../../contracts/jsonSafe.js";
import { createShadowDiagnostics } from "../contracts/shadowDiagnostics.js";
import { createShadowEligibility } from "../contracts/shadowEligibility.js";
import { createShadowExecutionPlan } from "../contracts/shadowExecutionPlan.js";
import { createShadowComparisonResult } from "../contracts/shadowComparison.js";
import { createShadowResultEnvelope } from "../contracts/shadowResultEnvelope.js";
import { createShadowExecutionRequest } from "../contracts/shadowRequest.js";

/**
 * @param {object} [input]
 * @param {object} [input.request]
 * @param {object} [input.eligibility]
 * @param {object} [input.plan]
 * @param {object} [input.comparison]
 * @param {object} [input.envelope]
 * @returns {import('../contracts/shadowDiagnostics.js').ShadowDiagnostics}
 */
export function buildShadowDiagnostics(input = {}) {
  const request = createShadowExecutionRequest(
    isPlainObject(input.request) ? input.request : {}
  );
  const eligibility = createShadowEligibility(
    isPlainObject(input.eligibility) ? input.eligibility : {}
  );
  const plan = createShadowExecutionPlan(
    isPlainObject(input.plan) ? input.plan : {}
  );
  const comparison = isPlainObject(input.comparison)
    ? createShadowComparisonResult(input.comparison)
    : null;
  const envelope = createShadowResultEnvelope(
    isPlainObject(input.envelope) ? input.envelope : {}
  );

  const reasonCodes = [
    ...eligibility.reasonCodes,
    plan.reasonCode,
    ...(comparison ? [comparison.reasonCode] : []),
  ].filter(Boolean);

  return createShadowDiagnostics({
    correlationId: request.correlationId,
    competitionId: request.competitionId,
    capability: request.capability,
    operation: request.operation,
    eligibility,
    plan,
    comparisonSummary: comparison
      ? {
          status: comparison.status,
          reasonCode: comparison.reasonCode,
          differenceCount: comparison.differences.length,
        }
      : null,
    reasonCodes: [...new Set(reasonCodes)],
    timings: {
      legacyDurationMs: envelope.legacyDurationMs,
      canonicalDurationMs: envelope.canonicalDurationMs,
    },
    metadata: {
      phase: "3A.2",
      persistence: false,
      analytics: false,
      console: false,
    },
  });
}
