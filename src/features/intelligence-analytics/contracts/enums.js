/**
 * Metric units, aggregation kinds, classification, and missing-data semantics.
 */

export const ANALYTICS_METRIC_UNIT = Object.freeze({
  COUNT: "count",
  CURRENCY: "currency",
  RATIO: "ratio",
  PERCENT: "percent",
  DURATION_SECONDS: "duration_seconds",
  DIMENSIONLESS: "dimensionless",
});

export const ANALYTICS_AGGREGATION_KIND = Object.freeze({
  COUNT: "count",
  SUM: "sum",
  AVERAGE: "average",
  RATE: "rate",
});

export const ANALYTICS_METRIC_KIND = Object.freeze({
  CANONICAL: "canonical",
  DERIVED: "derived",
  OBSERVATIONAL: "observational",
});

/**
 * Missing / null observation handling. Never silently coerce to zero unless
 * the metric definition explicitly selects COALESCE_ZERO.
 */
export const ANALYTICS_MISSING_DATA_SEMANTICS = Object.freeze({
  PRESERVE_NULL: "preserve_null",
  OMIT: "omit",
  FAIL: "fail",
  COALESCE_ZERO: "coalesce_zero",
});

export const ANALYTICS_GRANULARITY = Object.freeze({
  RAW: "raw",
  HOUR: "hour",
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  WINDOW: "window",
});

export const ANALYTICS_FRESHNESS_STATE = Object.freeze({
  FRESH: "fresh",
  STALE: "stale",
  UNKNOWN: "unknown",
});
