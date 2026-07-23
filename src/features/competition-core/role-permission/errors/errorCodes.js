export const AUTHORIZATION_ERROR_CODE = Object.freeze({
  INVALID_CONTRACT: "CORE02_AUTHZ_INVALID_CONTRACT",
  EVALUATION_FAILED: "CORE02_AUTHZ_EVALUATION_FAILED",
  ADAPTER_UNAVAILABLE: "CORE02_AUTHZ_ADAPTER_UNAVAILABLE",
});

export const AUTHORIZATION_ERROR_CODE_VALUES = Object.freeze(
  Object.values(AUTHORIZATION_ERROR_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAuthorizationErrorCode(value) {
  return AUTHORIZATION_ERROR_CODE_VALUES.includes(String(value || ""));
}
