/**
 * Trace Context contract (Platform Core Phase 1D).
 *
 * Technical linkage between operations or events via optional correlationId
 * and causationId. Does not generate IDs, look up parent events, access a
 * database, or perform distributed tracing.
 */

import { fail, ok } from "./result.js";
import { normalizeOpaqueId } from "./opaqueId.js";

/**
 * @typedef {{
 *   correlationId?: string,
 *   causationId?: string,
 * }} TraceContext
 */

export const TRACE_CONTEXT_ERROR = Object.freeze({
  INVALID: "TRACE_CONTEXT_INVALID",
  CORRELATION_ID_INVALID: "TRACE_CORRELATION_ID_INVALID",
  CAUSATION_ID_INVALID: "TRACE_CAUSATION_ID_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function traceContextError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @param {string} field
 * @param {string} errorCode
 * @returns {import("./result.js").Result}
 */
function normalizeOptionalTraceId(input, field, errorCode) {
  if (!(field in input) || input[field] === undefined) {
    return ok(undefined);
  }

  const result = normalizeOpaqueId(input[field]);
  if (!result.ok) {
    return fail(
      traceContextError(
        errorCode,
        `TraceContext ${field} must be a non-empty opaque identifier`,
        field
      )
    );
  }

  return ok(result.value);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createTraceContext(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      traceContextError(
        TRACE_CONTEXT_ERROR.INVALID,
        "TraceContext input must be a plain object"
      )
    );
  }

  const correlationIdResult = normalizeOptionalTraceId(
    input,
    "correlationId",
    TRACE_CONTEXT_ERROR.CORRELATION_ID_INVALID
  );
  if (!correlationIdResult.ok) return correlationIdResult;

  const causationIdResult = normalizeOptionalTraceId(
    input,
    "causationId",
    TRACE_CONTEXT_ERROR.CAUSATION_ID_INVALID
  );
  if (!causationIdResult.ok) return causationIdResult;

  /** @type {TraceContext} */
  const context = {};

  if (correlationIdResult.value !== undefined) {
    context.correlationId = correlationIdResult.value;
  }
  if (causationIdResult.value !== undefined) {
    context.causationId = causationIdResult.value;
  }

  return ok(Object.freeze(context));
}

/**
 * @param {*} value
 * @returns {value is TraceContext}
 */
export function isTraceContext(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return createTraceContext(value).ok === true;
}
