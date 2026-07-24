/**
 * Public contract barrel for Intelligence & Analytics foundation.
 */

export { ok, fail, isOk, isFail } from "./result.js";
export { ANALYTICS_ERROR_CODE, analyticsError } from "./errors.js";
export {
  isPlainObject,
  isNonEmptyString,
  isValidIsoTimestamp,
  deepFreeze,
  clonePlain,
  isFiniteNumber,
} from "./shared.js";
export {
  ANALYTICS_METRIC_UNIT,
  ANALYTICS_AGGREGATION_KIND,
  ANALYTICS_METRIC_KIND,
  ANALYTICS_MISSING_DATA_SEMANTICS,
  ANALYTICS_GRANULARITY,
  ANALYTICS_FRESHNESS_STATE,
} from "./enums.js";
export { createAnalyticsMetricId, createAnalyticsMetricVersion } from "./identifiers.js";
export {
  createAnalyticsMetricSource,
  createAnalyticsMetricProvenance,
} from "./source.js";
export {
  ANALYTICS_TENANT_SCOPE_KIND,
  createAnalyticsTenantScope,
} from "./tenantScope.js";
export {
  createAnalyticsTimeWindow,
  createAnalyticsGranularity,
} from "./timeWindow.js";
export {
  ANALYTICS_FILTER_OPERATOR,
  createAnalyticsDimension,
  createAnalyticsFilter,
  createAnalyticsGrouping,
  createAnalyticsOrdering,
} from "./queryParts.js";
export { createAnalyticsMetricDefinition } from "./metricDefinition.js";
export {
  createAnalyticsQueryDescriptor,
  cloneAnalyticsQueryDescriptor,
} from "./queryDescriptor.js";
export {
  createAnalyticsDataPoint,
  createAnalyticsSeries,
  createAnalyticsWarning,
  createAnalyticsResult,
} from "./analyticsResult.js";
