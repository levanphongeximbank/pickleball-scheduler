/**
 * Analytics metric identity and version contracts.
 */

import { fail, ok } from "./result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "./errors.js";
import { isNonEmptyString } from "./shared.js";

/**
 * @typedef {string} AnalyticsMetricId
 * @typedef {string} AnalyticsMetricVersion
 */

/**
 * @param {unknown} value
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsMetricId(value) {
  if (!isNonEmptyString(value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.METRIC_ID_REQUIRED,
        "AnalyticsMetricId is required and must be a non-empty string",
        "metricId"
      )
    );
  }
  return ok(String(value).trim());
}

/**
 * Semver-like or opaque version string. Must be non-empty.
 * @param {unknown} value
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsMetricVersion(value) {
  if (!isNonEmptyString(value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.METRIC_VERSION_REQUIRED,
        "AnalyticsMetricVersion is required and must be a non-empty string",
        "metricVersion"
      )
    );
  }
  return ok(String(value).trim());
}
