/**
 * Delivery failure classification — Phase 1.5.
 * Transient → retry; permanent → no automatic retry.
 */

export const FAILURE_CLASSES = Object.freeze({
  TRANSIENT: "TRANSIENT",
  PERMANENT: "PERMANENT",
});

export const TRANSIENT_ERROR_CODES = Object.freeze([
  "timeout",
  "provider_unavailable",
  "rate_limit",
  "network_temporary",
  "auth_temporary",
  "temporary_network_failure",
  "temporary_authentication_outage",
]);

export const PERMANENT_ERROR_CODES = Object.freeze([
  "invalid_recipient",
  "unsupported_channel",
  "malformed_payload",
  "recipient_opt_out",
  "disabled_provider",
  "invalid_provider_config",
  "live_mode_blocked",
  "sandbox_required",
]);

const SECRET_PATTERNS = [
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /password\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*\S+/gi,
  /bearer\s+[a-z0-9._-]+/gi,
  /sk_[a-z0-9]+/gi,
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
];

/**
 * Classify an error code / message into TRANSIENT or PERMANENT.
 */
export function classifyDeliveryFailure({ errorCode = null, message = "" } = {}) {
  const code = String(errorCode || "").trim().toLowerCase();
  if (TRANSIENT_ERROR_CODES.includes(code)) {
    return {
      class: FAILURE_CLASSES.TRANSIENT,
      retryable: true,
      errorCode: code || "transient_failure",
    };
  }
  if (PERMANENT_ERROR_CODES.includes(code)) {
    return {
      class: FAILURE_CLASSES.PERMANENT,
      retryable: false,
      errorCode: code || "permanent_failure",
    };
  }

  const lower = String(message || "").toLowerCase();
  if (
    /timeout|temporar|unavailable|rate.?limit|econnreset|etimedout|503|429/.test(lower)
  ) {
    return {
      class: FAILURE_CLASSES.TRANSIENT,
      retryable: true,
      errorCode: code || "transient_failure",
    };
  }

  return {
    class: FAILURE_CLASSES.PERMANENT,
    retryable: false,
    errorCode: code || "permanent_failure",
  };
}

/**
 * Strip secrets / tokens from error text before persistence or logs.
 */
export function sanitizeDeliveryErrorMessage(raw, { maxLength = 400 } = {}) {
  let text = String(raw || "").trim();
  if (!text) return null;
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, "[redacted]");
  }
  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength)}…`;
  }
  return text;
}
