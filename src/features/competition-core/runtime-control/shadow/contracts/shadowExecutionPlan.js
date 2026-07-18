/**
 * Shadow execution plan contract (Phase 3A.2).
 * Plan only — never invokes executors.
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";
import {
  SHADOW_PRIMARY_EXECUTION,
  SHADOW_SECONDARY_EXECUTION,
  SHADOW_RETURN_SOURCE,
} from "../constants/shadowExecutors.js";
import { SHADOW_REASON_CODE } from "../constants/shadowReasonCodes.js";

/**
 * @typedef {Object} ShadowExecutionPlan
 * @property {string} primaryExecution
 * @property {string} shadowExecution
 * @property {string} resultReturnSource
 * @property {boolean} shadowExecutionEnabled
 * @property {boolean} canonicalInvocationAllowed
 * @property {string} reasonCode
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<ShadowExecutionPlan>|null|undefined} partial
 * @returns {ShadowExecutionPlan}
 */
export function createShadowExecutionPlan(partial = {}) {
  return {
    primaryExecution: SHADOW_PRIMARY_EXECUTION.LEGACY,
    shadowExecution:
      partial?.shadowExecution === SHADOW_SECONDARY_EXECUTION.CANONICAL
        ? SHADOW_SECONDARY_EXECUTION.CANONICAL
        : SHADOW_SECONDARY_EXECUTION.NONE,
    resultReturnSource: SHADOW_RETURN_SOURCE.LEGACY,
    shadowExecutionEnabled: Boolean(partial?.shadowExecutionEnabled),
    canonicalInvocationAllowed: Boolean(partial?.canonicalInvocationAllowed),
    reasonCode:
      typeof partial?.reasonCode === "string" && partial.reasonCode
        ? partial.reasonCode
        : SHADOW_REASON_CODE.PLAN_SKIPPED,
    metadata: isPlainObject(partial?.metadata)
      ? cloneJsonSafe(partial.metadata)
      : {},
  };
}
