/**
 * Period comparison, absolute/relative change, growth rate (I&A-05).
 * No business interpretation. Division by zero → indeterminate (never Infinity).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsMetricId, createAnalyticsMetricVersion } from "../contracts/identifiers.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import { createAnalyticsTimeWindow } from "../contracts/timeWindow.js";
import {
  ANALYTICS_CHANGE_DIRECTION,
  ANALYTICS_COMPARISON_KIND,
  isHistoricalEnumValue,
} from "./enums.js";

/**
 * @param {number | null | undefined} current
 * @param {number | null | undefined} baseline
 */
export function createAnalyticsChange(current, baseline) {
  if (current === null || current === undefined || !isFiniteNumber(current)) {
    return ok(
      deepFreeze({
        absolute: null,
        relative: null,
        percentage: null,
        direction: ANALYTICS_CHANGE_DIRECTION.INDETERMINATE,
        available: false,
      })
    );
  }
  if (baseline === null || baseline === undefined || !isFiniteNumber(baseline)) {
    return ok(
      deepFreeze({
        absolute: null,
        relative: null,
        percentage: null,
        direction: ANALYTICS_CHANGE_DIRECTION.INDETERMINATE,
        available: false,
        reason: "missing_baseline",
      })
    );
  }

  const absolute = current - baseline;
  // Never return Infinity when baseline is zero.
  const relative = baseline === 0 ? null : absolute / baseline;
  const percentage = relative === null ? null : relative * 100;

  let direction = ANALYTICS_CHANGE_DIRECTION.NO_CHANGE;
  if (absolute > 0) direction = ANALYTICS_CHANGE_DIRECTION.INCREASE;
  else if (absolute < 0) direction = ANALYTICS_CHANGE_DIRECTION.DECREASE;

  return ok(
    deepFreeze({
      absolute,
      relative,
      percentage,
      direction,
      available: true,
      baselineZero: baseline === 0,
    })
  );
}

/**
 * @param {number | null | undefined} current
 * @param {number | null | undefined} baseline
 */
export function createAnalyticsGrowthRate(current, baseline) {
  const change = createAnalyticsChange(current, baseline);
  if (!change.ok) return change;
  return ok(
    deepFreeze({
      rate: change.value.relative,
      percentage: change.value.percentage,
      direction: change.value.direction,
      available: change.value.available,
      method: "period_over_period_relative_change",
      ...(change.value.baselineZero ? { baselineZero: true } : {}),
      ...(change.value.reason ? { reason: change.value.reason } : {}),
    })
  );
}

/**
 * Sum observed (non-missing, finite) series point values.
 * @param {{ points?: ReadonlyArray<{ value: number|null, missing?: boolean, synthetic?: boolean }> }} series
 * @param {{ includeSynthetic?: boolean }} [options]
 */
export function sumSeriesObservedValues(series, options = {}) {
  if (!isPlainObject(series) || !Array.isArray(series.points)) return null;
  let sum = 0;
  let count = 0;
  for (const point of series.points) {
    if (!isPlainObject(point)) continue;
    if (point.missing) continue;
    if (point.synthetic && !options.includeSynthetic) continue;
    if (!isFiniteNumber(point.value)) continue;
    sum += point.value;
    count += 1;
  }
  if (count === 0) return null;
  return sum;
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function compareHistoricalPeriods(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_COMPARISON_INVALID,
        "compareHistoricalPeriods requires a plain object",
        "comparison"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) return metricIdResult;
  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) return versionResult;

  const kind = isNonEmptyString(input.kind)
    ? String(input.kind).trim()
    : ANALYTICS_COMPARISON_KIND.PREVIOUS_EQUIVALENT_PERIOD;
  if (!isHistoricalEnumValue(kind, ANALYTICS_COMPARISON_KIND)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_COMPARISON_INVALID,
        `Unsupported comparison kind: ${kind}`,
        "comparison.kind"
      )
    );
  }

  const currentWindow = createAnalyticsTimeWindow(input.currentWindow);
  if (!currentWindow.ok) return currentWindow;
  const baselineWindow = createAnalyticsTimeWindow(input.baselineWindow);
  if (!baselineWindow.ok) return baselineWindow;

  // Incompatible windows: overlapping spans with different lengths when durations differ wildly is ok;
  // reject only when windows are identical for previous-period (not a comparison) OR inverted.
  const currentDuration =
    Date.parse(currentWindow.value.endAt) - Date.parse(currentWindow.value.startAt);
  const baselineDuration =
    Date.parse(baselineWindow.value.endAt) - Date.parse(baselineWindow.value.startAt);
  if (currentDuration < 0 || baselineDuration < 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_COMPARISON_INVALID,
        "Incompatible comparison windows",
        "comparison.timeWindow"
      )
    );
  }

  const currentValue =
    input.currentValue === null || input.currentValue === undefined
      ? null
      : isFiniteNumber(input.currentValue)
        ? input.currentValue
        : null;
  const baselineValue =
    input.baselineValue === null || input.baselineValue === undefined
      ? null
      : isFiniteNumber(input.baselineValue)
        ? input.baselineValue
        : null;

  if (
    input.currentValue !== null &&
    input.currentValue !== undefined &&
    !isFiniteNumber(input.currentValue)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT,
        "currentValue must be finite or null",
        "comparison.currentValue"
      )
    );
  }
  if (
    input.baselineValue !== null &&
    input.baselineValue !== undefined &&
    !isFiniteNumber(input.baselineValue)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT,
        "baselineValue must be finite or null",
        "comparison.baselineValue"
      )
    );
  }

  const changeResult = createAnalyticsChange(currentValue, baselineValue);
  if (!changeResult.ok) return changeResult;
  const growthResult = createAnalyticsGrowthRate(currentValue, baselineValue);
  if (!growthResult.ok) return growthResult;

  return ok(
    deepFreeze({
      kind,
      metricId: metricIdResult.value,
      metricVersion: versionResult.value,
      currentWindow: currentWindow.value,
      baselineWindow: baselineWindow.value,
      currentValue,
      baselineValue,
      change: changeResult.value,
      growthRate: growthResult.value,
      ...(isNonEmptyString(input.baselineLabel)
        ? { baselineLabel: String(input.baselineLabel).trim() }
        : {}),
    })
  );
}

/**
 * Shift a window backward by its own duration for previous-equivalent-period.
 * @param {{ startAt: string, endAt: string, inclusive?: boolean, timezone?: string }} window
 */
export function previousEquivalentWindow(window) {
  const startMs = Date.parse(window.startAt);
  const endMs = Date.parse(window.endAt);
  const duration = endMs - startMs;
  if (!(duration >= 0)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_COMPARISON_INVALID,
        "Cannot derive previous period from invalid window",
        "timeWindow"
      )
    );
  }
  return createAnalyticsTimeWindow({
    startAt: new Date(startMs - duration).toISOString(),
    endAt: new Date(endMs - duration).toISOString(),
    inclusive: window.inclusive,
    ...(window.timezone ? { timezone: window.timezone } : {}),
  });
}
