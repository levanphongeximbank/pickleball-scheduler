/**
 * Redacted diagnostics — strips secret-shaped fields; never logs values.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
} from "./shared.js";
import {
  FORBIDDEN_SECRET_VALUE_FIELDS,
  REDACTED_MARKER,
  isSecretShapedKey,
} from "./secretBoundaryShared.js";

export const REDACTED_DIAGNOSTICS_ERROR = Object.freeze({
  INVALID: "REDACTED_DIAGNOSTICS_INVALID",
});

/**
 * @param {*} value
 * @returns {*}
 */
function redactValue(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  /** @type {Record<string, *>} */
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      FORBIDDEN_SECRET_VALUE_FIELDS.includes(key) ||
      isSecretShapedKey(key)
    ) {
      out[key] = REDACTED_MARKER;
      continue;
    }
    out[key] = redactValue(item);
  }
  return out;
}

/**
 * Produce an immutable redacted diagnostics object.
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createRedactedDiagnostics(input) {
  if (input === undefined || input === null) {
    return fail(
      contractError(
        REDACTED_DIAGNOSTICS_ERROR.INVALID,
        "diagnostics input is required"
      )
    );
  }
  if (!isPlainObject(input) && !Array.isArray(input)) {
    // Scalars are allowed as opaque notes without redaction of content
    // (callers should not put secrets in scalars).
    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      return ok(deepFreeze({ note: input, redacted: true }));
    }
    return fail(
      contractError(
        REDACTED_DIAGNOSTICS_ERROR.INVALID,
        "diagnostics input must be a plain object, array, or scalar"
      )
    );
  }

  return ok(
    deepFreeze({
      redacted: true,
      diagnostics: redactValue(input),
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function diagnosticsContainRedactedMarker(value) {
  if (value === REDACTED_MARKER) return true;
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item) => diagnosticsContainRedactedMarker(item));
  }
  return Object.values(value).some((item) =>
    diagnosticsContainRedactedMarker(item)
  );
}

export { REDACTED_MARKER };
