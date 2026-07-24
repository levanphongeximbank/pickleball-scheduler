/**
 * Immutable AnalyticsQueryDescriptor.
 * Explicit tenant scope, metric version, time window, dimensions/grouping.
 * No SQL, table names, or module-specific business calculations.
 */

import { fail, ok } from "./result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "./errors.js";
import { createAnalyticsMetricId, createAnalyticsMetricVersion } from "./identifiers.js";
import { createAnalyticsTenantScope } from "./tenantScope.js";
import { createAnalyticsGranularity, createAnalyticsTimeWindow } from "./timeWindow.js";
import {
  createAnalyticsFilter,
  createAnalyticsGrouping,
  createAnalyticsOrdering,
} from "./queryParts.js";
import { ANALYTICS_AGGREGATION_KIND } from "./enums.js";
import { clonePlain, deepFreeze, isNonEmptyString, isPlainObject } from "./shared.js";

/**
 * @typedef {{
 *   metricId: string,
 *   metricVersion: string,
 *   tenantScope: import("./tenantScope.js").AnalyticsTenantScope,
 *   timeWindow: import("./timeWindow.js").AnalyticsTimeWindow,
 *   aggregationKind: string,
 *   granularity: string,
 *   filters: ReadonlyArray<import("./queryParts.js").AnalyticsFilter>,
 *   grouping?: import("./queryParts.js").AnalyticsGrouping,
 *   ordering?: ReadonlyArray<import("./queryParts.js").AnalyticsOrdering>,
 * }} AnalyticsQueryDescriptor
 */

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsQueryDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.QUERY_DESCRIPTOR_INVALID,
        "AnalyticsQueryDescriptor must be a plain object",
        "query"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) return metricIdResult;

  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) return versionResult;

  const tenantScopeResult = createAnalyticsTenantScope(input.tenantScope);
  if (!tenantScopeResult.ok) return tenantScopeResult;

  const timeWindowResult = createAnalyticsTimeWindow(input.timeWindow);
  if (!timeWindowResult.ok) return timeWindowResult;

  const aggregationKind = isNonEmptyString(input.aggregationKind)
    ? String(input.aggregationKind).trim()
    : "";
  if (!Object.values(ANALYTICS_AGGREGATION_KIND).includes(aggregationKind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.UNSUPPORTED_AGGREGATION,
        `Unsupported aggregation kind: ${aggregationKind || "(empty)"}`,
        "query.aggregationKind",
        { aggregationKind }
      )
    );
  }

  const granularityResult = createAnalyticsGranularity(
    input.granularity === undefined ? "window" : input.granularity
  );
  if (!granularityResult.ok) return granularityResult;

  /** @type {import("./queryParts.js").AnalyticsFilter[]} */
  const filters = [];
  if (input.filters !== undefined) {
    if (!Array.isArray(input.filters)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.QUERY_DESCRIPTOR_INVALID,
          "AnalyticsQueryDescriptor.filters must be an array",
          "query.filters"
        )
      );
    }
    for (const filterInput of input.filters) {
      const filterResult = createAnalyticsFilter(filterInput);
      if (!filterResult.ok) return filterResult;
      filters.push(filterResult.value);
    }
  }

  /** @type {AnalyticsQueryDescriptor} */
  const descriptor = {
    metricId: metricIdResult.value,
    metricVersion: versionResult.value,
    tenantScope: tenantScopeResult.value,
    timeWindow: timeWindowResult.value,
    aggregationKind,
    granularity: granularityResult.value,
    filters: Object.freeze([...filters]),
  };

  if (input.grouping !== undefined) {
    const groupingResult = createAnalyticsGrouping(input.grouping);
    if (!groupingResult.ok) return groupingResult;
    descriptor.grouping = groupingResult.value;
  }

  if (input.ordering !== undefined) {
    if (!Array.isArray(input.ordering)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.QUERY_DESCRIPTOR_INVALID,
          "AnalyticsQueryDescriptor.ordering must be an array",
          "query.ordering"
        )
      );
    }
    /** @type {import("./queryParts.js").AnalyticsOrdering[]} */
    const ordering = [];
    for (const orderInput of input.ordering) {
      const orderResult = createAnalyticsOrdering(orderInput);
      if (!orderResult.ok) return orderResult;
      ordering.push(orderResult.value);
    }
    descriptor.ordering = Object.freeze([...ordering]);
  }

  // Reject accidental SQL / table coupling markers in the descriptor surface.
  const serialized = JSON.stringify(descriptor).toLowerCase();
  if (
    serialized.includes("select ") ||
    serialized.includes(" from ") ||
    /"table"\s*:/.test(JSON.stringify(input).toLowerCase())
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.QUERY_DESCRIPTOR_INVALID,
        "AnalyticsQueryDescriptor must not embed SQL or table-name contracts",
        "query"
      )
    );
  }

  return ok(deepFreeze(descriptor));
}

/**
 * Returns a frozen deep clone so callers cannot mutate the original descriptor.
 * @param {AnalyticsQueryDescriptor} descriptor
 * @returns {AnalyticsQueryDescriptor}
 */
export function cloneAnalyticsQueryDescriptor(descriptor) {
  return deepFreeze(clonePlain(descriptor));
}
