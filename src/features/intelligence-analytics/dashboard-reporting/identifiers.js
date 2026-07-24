/**
 * Dashboard / report identity contracts (I&A-04).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isNonEmptyString } from "../contracts/shared.js";

/**
 * @typedef {string} AnalyticsDashboardId
 * @typedef {string} AnalyticsDashboardVersion
 * @typedef {string} AnalyticsReportId
 * @typedef {string} AnalyticsReportVersion
 */

/**
 * @param {unknown} value
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsDashboardId(value) {
  if (!isNonEmptyString(value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DASHBOARD_ID_REQUIRED,
        "AnalyticsDashboardId is required and must be a non-empty string",
        "dashboardId"
      )
    );
  }
  return ok(String(value).trim());
}

/**
 * @param {unknown} value
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsDashboardVersion(value) {
  if (!isNonEmptyString(value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DASHBOARD_VERSION_REQUIRED,
        "AnalyticsDashboardVersion is required and must be a non-empty string",
        "dashboardVersion"
      )
    );
  }
  return ok(String(value).trim());
}

/**
 * @param {unknown} value
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsReportId(value) {
  if (!isNonEmptyString(value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REPORT_ID_REQUIRED,
        "AnalyticsReportId is required and must be a non-empty string",
        "reportId"
      )
    );
  }
  return ok(String(value).trim());
}

/**
 * @param {unknown} value
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsReportVersion(value) {
  if (!isNonEmptyString(value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REPORT_VERSION_REQUIRED,
        "AnalyticsReportVersion is required and must be a non-empty string",
        "reportVersion"
      )
    );
  }
  return ok(String(value).trim());
}

/**
 * @param {string} id
 * @param {string} version
 * @returns {string}
 */
export function dashboardIdentityKey(id, version) {
  return `${id}::${version}`;
}

/**
 * @param {string} id
 * @param {string} version
 * @returns {string}
 */
export function reportIdentityKey(id, version) {
  return `${id}::${version}`;
}
