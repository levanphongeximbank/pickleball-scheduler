/**
 * Shadow execution request contract (Phase 3A.2).
 * Pure data — no env / clock / RNG / Supabase / executor calls.
 */

import { cloneJsonSafe, isPlainObject } from "../../contracts/jsonSafe.js";
import { createRuntimeDecision } from "../../contracts/runtimeDecision.js";
import { createExecutionContext } from "../../contracts/executionContext.js";

/**
 * @typedef {Object} ShadowExecutionRequest
 * @property {string|null} competitionId
 * @property {string} capability
 * @property {string} operation
 * @property {string} correlationId
 * @property {import('../../contracts/executionContext.js').ExecutionContext} executionContext
 * @property {unknown} legacyInput
 * @property {unknown} canonicalInput
 * @property {import('../../contracts/runtimeDecision.js').RuntimeDecision} runtimeDecision
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<ShadowExecutionRequest>|null|undefined} partial
 * @returns {ShadowExecutionRequest}
 */
export function createShadowExecutionRequest(partial = {}) {
  const metaIn = isPlainObject(partial?.metadata) ? partial.metadata : {};
  return {
    competitionId:
      typeof partial?.competitionId === "string" ? partial.competitionId : null,
    capability: typeof partial?.capability === "string" ? partial.capability : "",
    operation: typeof partial?.operation === "string" ? partial.operation : "",
    correlationId:
      typeof partial?.correlationId === "string" ? partial.correlationId : "",
    executionContext: createExecutionContext(
      isPlainObject(partial?.executionContext) ? partial.executionContext : {}
    ),
    legacyInput:
      partial?.legacyInput === undefined
        ? null
        : cloneJsonSafe(partial.legacyInput),
    canonicalInput:
      partial?.canonicalInput === undefined
        ? null
        : cloneJsonSafe(partial.canonicalInput),
    runtimeDecision: createRuntimeDecision(
      isPlainObject(partial?.runtimeDecision) ? partial.runtimeDecision : {}
    ),
    metadata: cloneJsonSafe(metaIn),
  };
}

/**
 * @param {unknown} request
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function assertShadowExecutionRequestShape(request) {
  const errors = [];
  if (!isPlainObject(request)) {
    return { ok: false, errors: ["request must be an object"] };
  }
  if (typeof request.capability !== "string" || !request.capability.trim()) {
    errors.push("capability is required");
  }
  if (typeof request.operation !== "string" || !request.operation.trim()) {
    errors.push("operation is required");
  }
  if (typeof request.correlationId !== "string" || !request.correlationId.trim()) {
    errors.push("correlationId is required");
  }
  if (!isPlainObject(request.executionContext)) {
    errors.push("executionContext is required");
  }
  if (!isPlainObject(request.runtimeDecision)) {
    errors.push("runtimeDecision is required");
  }
  return { ok: errors.length === 0, errors };
}
