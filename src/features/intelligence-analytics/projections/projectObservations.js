/**
 * Module-neutral projection helpers for analytics data points and series.
 * No domain-module calculation duplication.
 */

import {
  createAnalyticsDataPoint,
  createAnalyticsSeries,
} from "../contracts/analyticsResult.js";

/**
 * Project an explicit observation into an AnalyticsDataPoint.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function projectAnalyticsDataPoint(input) {
  return createAnalyticsDataPoint(input);
}

/**
 * Project explicit observations into an AnalyticsSeries.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function projectAnalyticsSeries(input) {
  return createAnalyticsSeries(input);
}
