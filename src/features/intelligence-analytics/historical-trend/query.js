/**
 * Historical query descriptor — immutable (I&A-05).
 * Exact metric ID/version, tenant, window, granularity, missing-period policy.
 * No SQL, callbacks, adapter instances, or arbitrary version selection.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_AGGREGATION_KIND, ANALYTICS_GRANULARITY } from "../contracts/enums.js";
import { createAnalyticsMetricId, createAnalyticsMetricVersion } from "../contracts/identifiers.js";
import { createAnalyticsTenantScope } from "../contracts/tenantScope.js";
import {
  createAnalyticsGranularity,
  createAnalyticsTimeWindow,
} from "../contracts/timeWindow.js";
import {
  createAnalyticsFilter,
  createAnalyticsGrouping,
} from "../contracts/queryParts.js";
import {
  clonePlain,
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_COMPARISON_KIND,
  ANALYTICS_MISSING_PERIOD_POLICY,
  ANALYTICS_MOVING_WINDOW_KIND,
  isHistoricalEnumValue,
} from "./enums.js";

const HISTORICAL_GRANULARITIES = new Set([
  ANALYTICS_GRANULARITY.HOUR,
  ANALYTICS_GRANULARITY.DAY,
  ANALYTICS_GRANULARITY.WEEK,
  ANALYTICS_GRANULARITY.MONTH,
]);

/**
 * @typedef {{
 *   metricId: string,
 *   metricVersion: string,
 *   tenantScope: import("../contracts/tenantScope.js").AnalyticsTenantScope,
 *   timeWindow: import("../contracts/timeWindow.js").AnalyticsTimeWindow,
 *   granularity: string,
 *   aggregationKind: string,
 *   missingPeriodPolicy: string,
 *   timezone: string,
 *   filters: ReadonlyArray<import("../contracts/queryParts.js").AnalyticsFilter>,
 *   grouping?: import("../contracts/queryParts.js").AnalyticsGrouping,
 *   comparison?: Readonly<{ kind: string, timeWindow?: import("../contracts/timeWindow.js").AnalyticsTimeWindow }>,
 *   baseline?: Readonly<{ timeWindow: import("../contracts/timeWindow.js").AnalyticsTimeWindow, label?: string }>,
 *   movingWindow?: Readonly<{ kind: string, size: number }>,
 *   includeCumulative?: boolean,
 *   maxBucketCount: number,
 * }} AnalyticsHistoricalQuery
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsHistoricalQuery(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "AnalyticsHistoricalQuery must be a plain object",
        "historicalQuery"
      )
    );
  }

  // Reject executable / coupling fields early.
  for (const forbidden of [
    "sql",
    "tableName",
    "table",
    "sourceAdapter",
    "callback",
    "onSuccess",
    "fn",
  ]) {
    if (input[forbidden] !== undefined) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT,
          `Historical query must not contain ${forbidden}`,
          `historicalQuery.${forbidden}`
        )
      );
    }
  }

  if (input.metricId === undefined || input.metricId === null || input.metricId === "") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.METRIC_ID_REQUIRED,
        "Historical query requires an exact metric ID",
        "historicalQuery.metricId"
      )
    );
  }
  if (
    input.metricVersion === undefined ||
    input.metricVersion === null ||
    input.metricVersion === ""
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.METRIC_VERSION_REQUIRED,
        "Historical query requires an exact metric version",
        "historicalQuery.metricVersion"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) return metricIdResult;
  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) return versionResult;

  if (input.tenantScope === undefined || input.tenantScope === null) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Historical query requires explicit tenant scope (fail closed)",
        "historicalQuery.tenantScope"
      )
    );
  }
  const tenantScopeResult = createAnalyticsTenantScope(input.tenantScope);
  if (!tenantScopeResult.ok) return tenantScopeResult;

  const timeWindowResult = createAnalyticsTimeWindow(input.timeWindow);
  if (!timeWindowResult.ok) return timeWindowResult;

  const granularityResult = createAnalyticsGranularity(
    input.granularity === undefined ? ANALYTICS_GRANULARITY.DAY : input.granularity
  );
  if (!granularityResult.ok) return granularityResult;
  if (!HISTORICAL_GRANULARITIES.has(granularityResult.value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        `Historical query granularity must be hour/day/week/month; got ${granularityResult.value}`,
        "historicalQuery.granularity"
      )
    );
  }

  const aggregationKind = isNonEmptyString(input.aggregationKind)
    ? String(input.aggregationKind).trim()
    : "";
  if (!Object.values(ANALYTICS_AGGREGATION_KIND).includes(aggregationKind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.UNSUPPORTED_AGGREGATION,
        `Unsupported aggregation kind: ${aggregationKind || "(empty)"}`,
        "historicalQuery.aggregationKind"
      )
    );
  }

  const missingPeriodPolicy = isNonEmptyString(input.missingPeriodPolicy)
    ? String(input.missingPeriodPolicy).trim()
    : ANALYTICS_MISSING_PERIOD_POLICY.PRESERVE_MISSING;
  if (!isHistoricalEnumValue(missingPeriodPolicy, ANALYTICS_MISSING_PERIOD_POLICY)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_MISSING_POLICY_INVALID,
        `Unsupported missing-period policy: ${missingPeriodPolicy}`,
        "historicalQuery.missingPeriodPolicy"
      )
    );
  }

  const timezone = isNonEmptyString(input.timezone)
    ? String(input.timezone).trim()
    : timeWindowResult.value.timezone || "UTC";
  // Foundation slice: UTC canonical basis only (no locale-dependent calendars).
  if (timezone !== "UTC") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "Historical foundation requires timezone UTC (canonical time basis)",
        "historicalQuery.timezone",
        { timezone }
      )
    );
  }

  /** @type {import("../contracts/queryParts.js").AnalyticsFilter[]} */
  const filters = [];
  if (input.filters !== undefined) {
    if (!Array.isArray(input.filters)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
          "filters must be an array",
          "historicalQuery.filters"
        )
      );
    }
    for (const filterInput of input.filters) {
      const filterResult = createAnalyticsFilter(filterInput);
      if (!filterResult.ok) return filterResult;
      filters.push(filterResult.value);
    }
  }

  /** @type {AnalyticsHistoricalQuery} */
  const descriptor = {
    metricId: metricIdResult.value,
    metricVersion: versionResult.value,
    tenantScope: tenantScopeResult.value,
    timeWindow: timeWindowResult.value,
    granularity: granularityResult.value,
    aggregationKind,
    missingPeriodPolicy,
    timezone,
    filters: Object.freeze([...filters]),
    maxBucketCount:
      input.maxBucketCount === undefined
        ? 366
        : Number(input.maxBucketCount),
  };

  if (!isFiniteNumber(descriptor.maxBucketCount) || descriptor.maxBucketCount < 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "maxBucketCount must be a positive finite number",
        "historicalQuery.maxBucketCount"
      )
    );
  }

  if (input.grouping !== undefined) {
    const groupingResult = createAnalyticsGrouping(input.grouping);
    if (!groupingResult.ok) return groupingResult;
    descriptor.grouping = groupingResult.value;
  }

  if (input.comparison !== undefined) {
    if (!isPlainObject(input.comparison)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_COMPARISON_INVALID,
          "comparison must be a plain object",
          "historicalQuery.comparison"
        )
      );
    }
    const kind = String(input.comparison.kind || "").trim();
    if (!isHistoricalEnumValue(kind, ANALYTICS_COMPARISON_KIND)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_COMPARISON_INVALID,
          `Unsupported comparison kind: ${kind}`,
          "historicalQuery.comparison.kind"
        )
      );
    }
    /** @type {{ kind: string, timeWindow?: import("../contracts/timeWindow.js").AnalyticsTimeWindow }} */
    const comparison = { kind };
    if (input.comparison.timeWindow !== undefined) {
      const cmpWindow = createAnalyticsTimeWindow(input.comparison.timeWindow);
      if (!cmpWindow.ok) return cmpWindow;
      comparison.timeWindow = cmpWindow.value;
    }
    descriptor.comparison = deepFreeze(comparison);
  }

  if (input.baseline !== undefined) {
    if (!isPlainObject(input.baseline) || input.baseline.timeWindow === undefined) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_COMPARISON_INVALID,
          "baseline requires an explicit timeWindow",
          "historicalQuery.baseline"
        )
      );
    }
    const baselineWindow = createAnalyticsTimeWindow(input.baseline.timeWindow);
    if (!baselineWindow.ok) return baselineWindow;
    descriptor.baseline = deepFreeze({
      timeWindow: baselineWindow.value,
      ...(isNonEmptyString(input.baseline.label)
        ? { label: String(input.baseline.label).trim() }
        : {}),
    });
  }

  if (input.movingWindow !== undefined) {
    if (!isPlainObject(input.movingWindow)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_MOVING_WINDOW_INVALID,
          "movingWindow must be a plain object",
          "historicalQuery.movingWindow"
        )
      );
    }
    const kind = String(input.movingWindow.kind || "").trim();
    if (!isHistoricalEnumValue(kind, ANALYTICS_MOVING_WINDOW_KIND)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_MOVING_WINDOW_INVALID,
          `Unsupported moving-window kind: ${kind}`,
          "historicalQuery.movingWindow.kind"
        )
      );
    }
    const size = Number(input.movingWindow.size);
    if (!isFiniteNumber(size) || size <= 0 || !Number.isInteger(size)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_MOVING_WINDOW_INVALID,
          "movingWindow.size must be a positive integer",
          "historicalQuery.movingWindow.size"
        )
      );
    }
    descriptor.movingWindow = deepFreeze({ kind, size });
  }

  if (input.includeCumulative !== undefined) {
    descriptor.includeCumulative = Boolean(input.includeCumulative);
  }

  return ok(deepFreeze(descriptor));
}

/**
 * Normalize caller input into an immutable historical query without mutating input.
 * @param {unknown} input
 */
export function normalizeHistoricalQuery(input) {
  const snapshot = isPlainObject(input) ? JSON.stringify(input) : null;
  const created = createAnalyticsHistoricalQuery(input);
  if (!created.ok) return created;
  if (snapshot !== null && JSON.stringify(input) !== snapshot) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "Historical query input must not be mutated during normalization",
        "historicalQuery"
      )
    );
  }
  return created;
}

/**
 * @param {AnalyticsHistoricalQuery} query
 */
export function cloneAnalyticsHistoricalQuery(query) {
  return deepFreeze(clonePlain(query));
}
