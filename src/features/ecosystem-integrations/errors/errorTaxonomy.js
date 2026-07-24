/**
 * Integration error taxonomy + deterministic retry classification.
 */

import {
  INTEGRATION_ERROR_CODE,
  INTEGRATION_ERROR_CODE_VALUES,
} from "../constants/catalogues.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

/** @type {Readonly<Record<string, boolean>>} */
export const INTEGRATION_ERROR_RETRYABLE = Object.freeze({
  [INTEGRATION_ERROR_CODE.CONFIGURATION]: false,
  [INTEGRATION_ERROR_CODE.AUTHENTICATION]: false,
  [INTEGRATION_ERROR_CODE.AUTHORIZATION]: false,
  [INTEGRATION_ERROR_CODE.VALIDATION]: false,
  [INTEGRATION_ERROR_CODE.UNSUPPORTED_CAPABILITY]: false,
  [INTEGRATION_ERROR_CODE.RATE_LIMITED]: true,
  [INTEGRATION_ERROR_CODE.TRANSIENT_PROVIDER]: true,
  [INTEGRATION_ERROR_CODE.TIMEOUT]: true,
  [INTEGRATION_ERROR_CODE.NETWORK]: true,
  [INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE]: false,
  [INTEGRATION_ERROR_CODE.PERMANENT_PROVIDER_REJECTION]: false,
  [INTEGRATION_ERROR_CODE.MALFORMED_PROVIDER_RESPONSE]: false,
  [INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE]: false,
});

const FORBIDDEN_CONTEXT_KEYS = Object.freeze([
  "secret",
  "password",
  "token",
  "authorization",
  "apiKey",
  "webhookSecret",
  "rawPayload",
  "rawBody",
  "rawResponse",
  "rawRequest",
  "accessToken",
  "refreshToken",
  "signature",
  "credential",
]);

/**
 * @param {object} [context]
 * @returns {object|undefined}
 */
function sanitizeContext(context) {
  if (!isPlainObject(context)) {
    return undefined;
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_CONTEXT_KEYS.includes(key)) continue;
    if (/(secret|password|token|authorization|api[_-]?key|raw|signature|credential)/i.test(key)) {
      continue;
    }
    out[key] = value;
  }
  return deepFreeze(out);
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {{ retryable?: boolean }} [options]
 */
export function createIntegrationError(code, message, context, options = {}) {
  if (!INTEGRATION_ERROR_CODE_VALUES.includes(code)) {
    throw new Error(`Unknown integration error code: ${String(code)}`);
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    throw new Error("Integration error message must be a non-empty string");
  }
  const retryable =
    options.retryable != null
      ? Boolean(options.retryable)
      : INTEGRATION_ERROR_RETRYABLE[code] === true;

  return deepFreeze({
    code,
    message: message.trim(),
    retryable,
    context: sanitizeContext(context),
  });
}

/**
 * Deterministic retry classification — no scheduler.
 * @param {string|{ code: string, retryable?: boolean }} errorOrCode
 * @returns {{ code: string, retryable: boolean, reason: string }}
 */
export function classifyIntegrationRetry(errorOrCode) {
  const code =
    typeof errorOrCode === "string"
      ? errorOrCode
      : errorOrCode && typeof errorOrCode === "object"
        ? errorOrCode.code
        : undefined;

  if (!INTEGRATION_ERROR_CODE_VALUES.includes(code)) {
    return deepFreeze({
      code: INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE,
      retryable: false,
      reason: "unknown_error_code",
    });
  }

  if (
    errorOrCode &&
    typeof errorOrCode === "object" &&
    typeof errorOrCode.retryable === "boolean"
  ) {
    return deepFreeze({
      code,
      retryable: errorOrCode.retryable,
      reason: errorOrCode.retryable ? "explicit_retryable_true" : "explicit_retryable_false",
    });
  }

  const retryable = INTEGRATION_ERROR_RETRYABLE[code] === true;
  return deepFreeze({
    code,
    retryable,
    reason: retryable ? "transient_class" : "permanent_class",
  });
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isRetryableIntegrationErrorCode(code) {
  return INTEGRATION_ERROR_RETRYABLE[code] === true;
}
