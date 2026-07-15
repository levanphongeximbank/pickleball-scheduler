/**
 * Canonical API / domain error-code registry.
 *
 * Phase 44B.0 (Foundation Lock): this is the single source of truth for internal
 * API and cross-domain error codes. Domain-specific sub-registries
 * (e.g. `PRIVATE_PAIRING_DB_CODE`, `EDGE_API_ERROR_CODES`) MUST keep their values
 * consistent with the codes registered here. Consistency and stability are enforced
 * by `scripts/ci/error-registry-check.mjs` and `tests/api-error-registry.test.js`.
 *
 * Contract rules (do not violate):
 * - Never rename or change the string VALUE of an existing code — values are
 *   external/runtime-stable and consumed by UI, callers and tests.
 * - Add new codes here and group them under `ERROR_CODE_DOMAINS`.
 * - Do not create a second, competing registry.
 */
export const API_ERROR_CODES = Object.freeze({
  // --- Core API layer (pre-existing; values unchanged) ---
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  FEATURE_DISABLED: "FEATURE_DISABLED",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  INSUFFICIENT_SCOPE: "INSUFFICIENT_SCOPE",
  TENANT_MISMATCH: "TENANT_MISMATCH",

  // --- Club scope (Phase 43A P0-5 / P0-6; registered in 44B.0) ---
  // Value stability note: already emitted by src/features/api/services/clubScopeService.js
  // and src/context/ClubContext.jsx as string literals with these exact values.
  CLUB_REQUIRED: "CLUB_REQUIRED",
  CLUB_OUT_OF_SCOPE: "CLUB_OUT_OF_SCOPE",
  // Value stability note: already returned by src/features/club/services/clubRegistryService.js.
  V2_DISABLED: "V2_DISABLED",

  // --- Tenant isolation ---
  // Value stability note: mirrors PRIVATE_PAIRING_DB_CODE.CROSS_TENANT_ACCESS.
  CROSS_TENANT_ACCESS: "CROSS_TENANT_ACCESS",

  // --- Audit integrity ---
  // Value stability note: mirrors PRIVATE_PAIRING_DB_CODE.AUDIT_APPEND_ONLY (server P0001).
  AUDIT_APPEND_ONLY: "AUDIT_APPEND_ONLY",
});

/**
 * Organizational domain groupings. Every value MUST come from `API_ERROR_CODES`
 * and every registered code MUST belong to exactly one group (verified by CI + tests).
 */
export const ERROR_CODE_DOMAINS = Object.freeze({
  CORE: Object.freeze([
    API_ERROR_CODES.UNAUTHORIZED,
    API_ERROR_CODES.FORBIDDEN,
    API_ERROR_CODES.NOT_FOUND,
    API_ERROR_CODES.VALIDATION_ERROR,
    API_ERROR_CODES.CONFLICT,
    API_ERROR_CODES.RATE_LIMITED,
    API_ERROR_CODES.INTERNAL_ERROR,
    API_ERROR_CODES.FEATURE_DISABLED,
    API_ERROR_CODES.INVALID_SIGNATURE,
    API_ERROR_CODES.INSUFFICIENT_SCOPE,
    API_ERROR_CODES.TENANT_MISMATCH,
  ]),
  CLUB: Object.freeze([
    API_ERROR_CODES.CLUB_REQUIRED,
    API_ERROR_CODES.CLUB_OUT_OF_SCOPE,
    API_ERROR_CODES.V2_DISABLED,
  ]),
  TENANT: Object.freeze([API_ERROR_CODES.CROSS_TENANT_ACCESS]),
  AUDIT: Object.freeze([API_ERROR_CODES.AUDIT_APPEND_ONLY]),
});

/** All registered canonical error-code values. */
export function listRegisteredApiErrorCodes() {
  return Object.values(API_ERROR_CODES);
}

/** True when `code` is a registered canonical API error code value. */
export function isRegisteredApiErrorCode(code) {
  return Object.values(API_ERROR_CODES).includes(code);
}
