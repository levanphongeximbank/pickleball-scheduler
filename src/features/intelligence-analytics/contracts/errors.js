/**
 * Typed error codes for Intelligence & Analytics foundation contracts.
 */

export const ANALYTICS_ERROR_CODE = Object.freeze({
  INVALID_INPUT: "ANALYTICS_INVALID_INPUT",
  METRIC_ID_REQUIRED: "ANALYTICS_METRIC_ID_REQUIRED",
  METRIC_VERSION_REQUIRED: "ANALYTICS_METRIC_VERSION_REQUIRED",
  TENANT_CONTEXT_REQUIRED: "ANALYTICS_TENANT_CONTEXT_REQUIRED",
  TENANT_SCOPE_INVALID: "ANALYTICS_TENANT_SCOPE_INVALID",
  TIME_WINDOW_INVALID: "ANALYTICS_TIME_WINDOW_INVALID",
  QUERY_DESCRIPTOR_INVALID: "ANALYTICS_QUERY_DESCRIPTOR_INVALID",
  UNSUPPORTED_AGGREGATION: "ANALYTICS_UNSUPPORTED_AGGREGATION",
  INVALID_NUMERIC_INPUT: "ANALYTICS_INVALID_NUMERIC_INPUT",
  MISSING_DATA_POLICY_VIOLATION: "ANALYTICS_MISSING_DATA_POLICY_VIOLATION",
  PROJECTION_INVALID: "ANALYTICS_PROJECTION_INVALID",
  FACADE_WRITE_REJECTED: "ANALYTICS_FACADE_WRITE_REJECTED",
  SOURCE_REQUIRED: "ANALYTICS_SOURCE_REQUIRED",
  DEFINITION_INVALID: "ANALYTICS_DEFINITION_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @param {Record<string, unknown>} [details]
 * @returns {Readonly<{ code: string, message: string, field?: string, details?: Readonly<Record<string, unknown>> }>}
 */
export function analyticsError(code, message, field, details) {
  /** @type {{ code: string, message: string, field?: string, details?: Readonly<Record<string, unknown>> }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  if (details !== undefined) {
    error.details = Object.freeze({ ...details });
  }
  return Object.freeze(error);
}
