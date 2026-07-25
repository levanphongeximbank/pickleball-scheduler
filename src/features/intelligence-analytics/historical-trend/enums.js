/**
 * I&A-05 — Historical / trend enums.
 * Granularity reuses ANALYTICS_GRANULARITY from I&A-01 (no duplicate enum).
 */

export const ANALYTICS_MISSING_PERIOD_POLICY = Object.freeze({
  PRESERVE_MISSING: "preserve_missing",
  FILL_ZERO_WHEN_ALLOWED: "fill_zero_when_allowed",
  FILL_NULL: "fill_null",
  OMIT: "omit",
});

export const ANALYTICS_TREND_DIRECTION = Object.freeze({
  INCREASING: "increasing",
  DECREASING: "decreasing",
  STABLE: "stable",
  VOLATILE: "volatile",
  INSUFFICIENT_DATA: "insufficient_data",
  INDETERMINATE: "indeterminate",
});

export const ANALYTICS_TREND_STRENGTH = Object.freeze({
  NONE: "none",
  WEAK: "weak",
  MODERATE: "moderate",
  STRONG: "strong",
  INDETERMINATE: "indeterminate",
});

export const ANALYTICS_CHANGE_DIRECTION = Object.freeze({
  INCREASE: "increase",
  DECREASE: "decrease",
  NO_CHANGE: "no_change",
  UNAVAILABLE: "unavailable",
  INDETERMINATE: "indeterminate",
});

export const ANALYTICS_COMPLETENESS_STATE = Object.freeze({
  COMPLETE: "complete",
  PARTIAL: "partial",
  EMPTY: "empty",
  UNAVAILABLE: "unavailable",
});

export const ANALYTICS_POINT_ORIGIN = Object.freeze({
  OBSERVED: "observed",
  SYNTHETIC_FILLED: "synthetic_filled",
  DERIVED: "derived",
  MISSING: "missing",
});

export const ANALYTICS_MOVING_WINDOW_KIND = Object.freeze({
  AVERAGE: "average",
  SUM: "sum",
  COUNT: "count",
});

export const ANALYTICS_CUMULATIVE_KIND = Object.freeze({
  SUM: "sum",
  COUNT: "count",
});

export const ANALYTICS_COMPARISON_KIND = Object.freeze({
  PREVIOUS_EQUIVALENT_PERIOD: "previous_equivalent_period",
  EXPLICIT_BASELINE: "explicit_baseline",
});

/**
 * @param {unknown} value
 * @param {Readonly<Record<string, string>>} enumObject
 */
export function isHistoricalEnumValue(value, enumObject) {
  return typeof value === "string" && Object.values(enumObject).includes(value);
}
