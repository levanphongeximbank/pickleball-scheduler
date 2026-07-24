/**
 * Event Trace Context Adapter — projects caller-supplied trace identifiers
 * into Platform Core TraceContext.
 *
 * Does not generate identifiers, look up request globals, access
 * environment or browser storage, or mutate input.
 */

import { fail } from "../../contracts/result.js";
import { createTraceContext } from "../../contracts/traceContext.js";

export const EVENT_TRACE_CONTEXT_ADAPTER_ERROR = Object.freeze({
  INVALID: "EVENT_TRACE_CONTEXT_ADAPTER_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * Project caller-supplied correlationId / causationId into TraceContext.
 * Empty plain objects are valid when the Trace Context contract allows them.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectEventTraceContext(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        EVENT_TRACE_CONTEXT_ADAPTER_ERROR.INVALID,
        "Event trace context input must be a plain object"
      )
    );
  }

  /** @type {{ correlationId?: *, causationId?: * }} */
  const payload = {};

  if ("correlationId" in input && input.correlationId !== undefined) {
    payload.correlationId = input.correlationId;
  }
  if ("causationId" in input && input.causationId !== undefined) {
    payload.causationId = input.causationId;
  }

  return createTraceContext(payload);
}
