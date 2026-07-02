/** Phase 11C — Edge API error codes (lowercase snake_case). */
export const EDGE_API_ERROR_CODES = Object.freeze({
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  RATE_LIMITED: "rate_limited",
  INVALID_API_KEY: "invalid_api_key",
  TENANT_NOT_FOUND: "tenant_not_found",
  SCOPE_DENIED: "scope_denied",
  NOT_FOUND: "not_found",
  VALIDATION_ERROR: "validation_error",
  FEATURE_DISABLED: "feature_disabled",
  INTERNAL_ERROR: "internal_error",
});

export const EDGE_ERROR_HTTP_STATUS = Object.freeze({
  [EDGE_API_ERROR_CODES.UNAUTHORIZED]: 401,
  [EDGE_API_ERROR_CODES.INVALID_API_KEY]: 401,
  [EDGE_API_ERROR_CODES.FORBIDDEN]: 403,
  [EDGE_API_ERROR_CODES.TENANT_NOT_FOUND]: 403,
  [EDGE_API_ERROR_CODES.SCOPE_DENIED]: 403,
  [EDGE_API_ERROR_CODES.NOT_FOUND]: 404,
  [EDGE_API_ERROR_CODES.VALIDATION_ERROR]: 400,
  [EDGE_API_ERROR_CODES.RATE_LIMITED]: 429,
  [EDGE_API_ERROR_CODES.FEATURE_DISABLED]: 503,
  [EDGE_API_ERROR_CODES.INTERNAL_ERROR]: 500,
});

export function edgeErrorStatus(code) {
  return EDGE_ERROR_HTTP_STATUS[code] || 500;
}
