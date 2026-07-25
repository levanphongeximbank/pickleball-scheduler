/**
 * I&A-05 — Historical and Trend Analysis public barrel.
 */

export {
  ANALYTICS_MISSING_PERIOD_POLICY,
  ANALYTICS_TREND_DIRECTION,
  ANALYTICS_TREND_STRENGTH,
  ANALYTICS_CHANGE_DIRECTION,
  ANALYTICS_COMPLETENESS_STATE,
  ANALYTICS_POINT_ORIGIN,
  ANALYTICS_MOVING_WINDOW_KIND,
  ANALYTICS_CUMULATIVE_KIND,
  ANALYTICS_COMPARISON_KIND,
  isHistoricalEnumValue,
} from "./enums.js";

export {
  createAnalyticsTimeBucket,
  enumerateBucketBoundaries,
  bucketStartUtc,
  nextBucketStartUtc,
  isTimestampInWindow,
  aggregateBucketValues,
} from "./timeBuckets.js";

export {
  createAnalyticsHistoricalQuery,
  normalizeHistoricalQuery,
  cloneAnalyticsHistoricalQuery,
} from "./query.js";

export {
  createAnalyticsHistoricalObservation,
  createAnalyticsHistoricalSeriesPoint,
  createAnalyticsHistoricalSeries,
  createAnalyticsCoverage,
} from "./series.js";

export { bucketHistoricalObservations } from "./bucketing.js";

export {
  createAnalyticsChange,
  createAnalyticsGrowthRate,
  compareHistoricalPeriods,
  previousEquivalentWindow,
  sumSeriesObservedValues,
} from "./comparison.js";

export { analyzeTrend } from "./trend.js";

export { applyMovingWindow, applyCumulative } from "./movingCumulative.js";

export { createInMemoryHistoricalSourceAdapter } from "./inMemoryHistoricalSource.js";

export {
  createHistoricalAnalyticsRuntime,
  createReadOnlyHistoricalAnalyticsFacade,
} from "./facade.js";
