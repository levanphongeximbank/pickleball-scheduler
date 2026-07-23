/**
 * Provider error helpers — typed Finance errors with retryability hints.
 * Never attach raw provider payloads or credentials to context.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";

/** @type {Readonly<Record<string, boolean>>} */
export const PROVIDER_ERROR_RETRYABLE = Object.freeze({
  [FINANCE_ERROR_CODES.PROVIDER_UNAVAILABLE]: true,
  [FINANCE_ERROR_CODES.PROVIDER_TIMEOUT]: true,
  [FINANCE_ERROR_CODES.PROVIDER_RATE_LIMITED]: true,
  [FINANCE_ERROR_CODES.PROVIDER_STATUS_UNKNOWN]: true,
  [FINANCE_ERROR_CODES.PROVIDER_UNSUPPORTED_OPERATION]: false,
  [FINANCE_ERROR_CODES.PROVIDER_UNSUPPORTED_CURRENCY]: false,
  [FINANCE_ERROR_CODES.PROVIDER_REJECTED]: false,
  [FINANCE_ERROR_CODES.PROVIDER_RESPONSE_INVALID]: false,
  [FINANCE_ERROR_CODES.PROVIDER_REFERENCE_CONFLICT]: false,
  [FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID]: false,
  [FINANCE_ERROR_CODES.PROVIDER_AUTHENTICATION_FAILED]: false,
  [FINANCE_ERROR_CODES.PROVIDER_WEBHOOK_INVALID]: false,
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
  "cardNumber",
  "cvv",
]);

/**
 * @param {object} [context]
 * @returns {object|undefined}
 */
function sanitizeContext(context) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return undefined;
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_CONTEXT_KEYS.includes(key)) continue;
    if (/(secret|password|token|authorization|api[_-]?key|raw)/i.test(key)) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {{ retryable?: boolean }} [options]
 * @returns {FinanceError}
 */
export function createProviderError(code, message, context, options = {}) {
  const retryable =
    options.retryable != null
      ? Boolean(options.retryable)
      : PROVIDER_ERROR_RETRYABLE[code] === true;
  return new FinanceError(code, message, {
    ...sanitizeContext(context),
    retryable,
  });
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @param {{ retryable?: boolean }} [options]
 * @returns {never}
 */
export function throwProviderError(code, message, context, options) {
  throw createProviderError(code, message, context, options);
}
