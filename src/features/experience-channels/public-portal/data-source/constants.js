/**
 * Public Portal data-result status (EC-03).
 * Reuses PUBLIC_PORTAL_DATA_SOURCE for provenance — no second enum.
 * LOADING remains caller-owned; this contract describes resolved outcomes.
 */

export const PUBLIC_DATA_RESULT_STATUS = Object.freeze({
  SUCCESS: "SUCCESS",
  EMPTY: "EMPTY",
  ERROR: "ERROR",
  UNAVAILABLE: "UNAVAILABLE",
});

export const PUBLIC_DATA_RESULT_STATUS_VALUES = Object.freeze(
  Object.values(PUBLIC_DATA_RESULT_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicDataResultStatus(value) {
  return PUBLIC_DATA_RESULT_STATUS_VALUES.includes(/** @type {string} */ (value));
}

/**
 * Stable fallback reason codes for MIXED / documented mock substitution.
 * Presentation may map these to user-facing copy; do not expose internals.
 */
export const PUBLIC_DATA_FALLBACK_REASON = Object.freeze({
  LIVE_EMPTY_USING_MOCK: "LIVE_EMPTY_USING_MOCK",
  LIVE_BELOW_MINIMUM_USING_MOCK: "LIVE_BELOW_MINIMUM_USING_MOCK",
  LIVE_LOAD_FAILED_USING_MOCK: "LIVE_LOAD_FAILED_USING_MOCK",
  EXPLICIT_MOCK_ONLY: "EXPLICIT_MOCK_ONLY",
  EXPLICIT_PREVIEW_ONLY: "EXPLICIT_PREVIEW_ONLY",
});

export const PUBLIC_DATA_FALLBACK_REASON_VALUES = Object.freeze(
  Object.values(PUBLIC_DATA_FALLBACK_REASON)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPublicDataFallbackReason(value) {
  return PUBLIC_DATA_FALLBACK_REASON_VALUES.includes(/** @type {string} */ (value));
}
