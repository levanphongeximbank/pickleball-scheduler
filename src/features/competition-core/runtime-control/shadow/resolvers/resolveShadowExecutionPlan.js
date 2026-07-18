/**
 * Shadow execution plan resolver (Phase 3A.2).
 * Always primary=LEGACY, returnSource=LEGACY. No executor invocation.
 */

import { isPlainObject } from "../../contracts/jsonSafe.js";
import { createShadowEligibility } from "../contracts/shadowEligibility.js";
import { createShadowExecutionPlan } from "../contracts/shadowExecutionPlan.js";
import {
  SHADOW_SECONDARY_EXECUTION,
} from "../constants/shadowExecutors.js";
import { SHADOW_REASON_CODE } from "../constants/shadowReasonCodes.js";

/**
 * @param {object} [input]
 * @param {import('../contracts/shadowEligibility.js').ShadowEligibility} [input.eligibility]
 * @returns {import('../contracts/shadowExecutionPlan.js').ShadowExecutionPlan}
 */
export function resolveShadowExecutionPlan(input = {}) {
  const eligibility = createShadowEligibility(
    isPlainObject(input.eligibility) ? input.eligibility : {}
  );

  if (!eligibility.eligible) {
    return createShadowExecutionPlan({
      shadowExecution: SHADOW_SECONDARY_EXECUTION.NONE,
      shadowExecutionEnabled: false,
      canonicalInvocationAllowed: false,
      reasonCode: SHADOW_REASON_CODE.PLAN_SKIPPED,
      metadata: {
        eligibilityReasonCode: eligibility.reasonCode,
      },
    });
  }

  return createShadowExecutionPlan({
    shadowExecution: SHADOW_SECONDARY_EXECUTION.CANONICAL,
    shadowExecutionEnabled: true,
    // Phase 3A.2: plan may mark canonical as the shadow target, but
    // Production wiring / real invocation remains OFF until a later phase.
    // Default safety: canonicalInvocationAllowed stays false unless explicitly
    // opted-in via input (still never changes return source).
    canonicalInvocationAllowed: input.canonicalInvocationAllowed === true,
    reasonCode: SHADOW_REASON_CODE.PLAN_CREATED,
    metadata: {
      eligibilityReasonCode: eligibility.reasonCode,
      phase: "3A.2",
      note: "plan_only_no_executor_dispatch",
    },
  });
}
