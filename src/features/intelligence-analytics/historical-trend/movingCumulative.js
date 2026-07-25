/**
 * Moving-window and cumulative analysis (I&A-05).
 * Derived markers only — never mutates source series.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_AGGREGATION_KIND } from "../contracts/enums.js";
import {
  deepFreeze,
  isFiniteNumber,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_CUMULATIVE_KIND,
  ANALYTICS_MOVING_WINDOW_KIND,
  ANALYTICS_POINT_ORIGIN,
  isHistoricalEnumValue,
} from "./enums.js";

/**
 * @param {unknown} series
 * @param {unknown} movingWindow
 */
export function applyMovingWindow(series, movingWindow) {
  if (!isPlainObject(series) || !Array.isArray(series.points)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_MOVING_WINDOW_INVALID,
        "Moving window requires a historical series with points",
        "series"
      )
    );
  }
  if (!isPlainObject(movingWindow)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_MOVING_WINDOW_INVALID,
        "movingWindow must be a plain object",
        "movingWindow"
      )
    );
  }

  const kind = String(movingWindow.kind || "").trim();
  if (!isHistoricalEnumValue(kind, ANALYTICS_MOVING_WINDOW_KIND)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_MOVING_WINDOW_INVALID,
        `Unsupported moving-window kind: ${kind}`,
        "movingWindow.kind"
      )
    );
  }
  const size = Number(movingWindow.size);
  if (!isFiniteNumber(size) || size <= 0 || !Number.isInteger(size)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_MOVING_WINDOW_INVALID,
        "movingWindow.size must be a positive integer",
        "movingWindow.size"
      )
    );
  }

  /** @type {any[]} */
  const output = [];
  const points = series.points;

  for (let i = 0; i < points.length; i += 1) {
    const start = i - size + 1;
    if (start < 0) {
      output.push(
        deepFreeze({
          bucket: points[i].bucket,
          value: null,
          missing: true,
          origin: ANALYTICS_POINT_ORIGIN.DERIVED,
          synthetic: false,
          derived: true,
          windowComplete: false,
          observationCount: 0,
        })
      );
      continue;
    }

    /** @type {number[]} */
    const windowValues = [];
    for (let j = start; j <= i; j += 1) {
      const p = points[j];
      if (!p || p.missing || !isFiniteNumber(p.value)) continue;
      // Do not treat synthetic filled zeros as observed unless already in series as value.
      windowValues.push(p.value);
    }

    let value = null;
    if (kind === ANALYTICS_MOVING_WINDOW_KIND.COUNT) {
      value = windowValues.length;
    } else if (windowValues.length === 0) {
      value = null;
    } else if (kind === ANALYTICS_MOVING_WINDOW_KIND.SUM) {
      value = windowValues.reduce((a, b) => a + b, 0);
    } else if (kind === ANALYTICS_MOVING_WINDOW_KIND.AVERAGE) {
      value = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
    }

    output.push(
      deepFreeze({
        bucket: points[i].bucket,
        value,
        missing: value === null,
        origin: ANALYTICS_POINT_ORIGIN.DERIVED,
        synthetic: false,
        derived: true,
        windowComplete: true,
        observationCount: windowValues.length,
      })
    );
  }

  return ok(
    deepFreeze({
      kind,
      size,
      points: Object.freeze(output),
      sourceSeriesId: series.seriesId,
      provenanceRetained: true,
    })
  );
}

/**
 * @param {unknown} series
 * @param {unknown} options
 */
export function applyCumulative(series, options = {}) {
  if (!isPlainObject(series) || !Array.isArray(series.points)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_CUMULATIVE_INVALID,
        "Cumulative analysis requires a historical series with points",
        "series"
      )
    );
  }

  const kind = isPlainObject(options) && options.kind
    ? String(options.kind).trim()
    : ANALYTICS_CUMULATIVE_KIND.SUM;

  if (!isHistoricalEnumValue(kind, ANALYTICS_CUMULATIVE_KIND)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_CUMULATIVE_INVALID,
        `Unsupported cumulative kind: ${kind}`,
        "cumulative.kind"
      )
    );
  }

  const aggregationKind =
    isPlainObject(options) && typeof options.aggregationKind === "string"
      ? options.aggregationKind
      : undefined;

  // Reject cumulative average/rate unless explicitly sum/count compatible.
  if (
    aggregationKind === ANALYTICS_AGGREGATION_KIND.AVERAGE ||
    aggregationKind === ANALYTICS_AGGREGATION_KIND.RATE
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_CUMULATIVE_INVALID,
        "Cumulative analysis is not supported for average/rate metrics",
        "cumulative.aggregationKind",
        { aggregationKind }
      )
    );
  }

  let running = 0;
  let runningCount = 0;
  /** @type {any[]} */
  const output = [];

  for (const point of series.points) {
    if (!isPlainObject(point)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_CUMULATIVE_INVALID,
          "Invalid series point",
          "series.points"
        )
      );
    }

    // Missing values are skipped (not coerced to zero).
    if (!point.missing && isFiniteNumber(point.value)) {
      if (kind === ANALYTICS_CUMULATIVE_KIND.SUM) {
        running += point.value;
      } else {
        runningCount += 1;
      }
    }

    const value =
      kind === ANALYTICS_CUMULATIVE_KIND.SUM ? running : runningCount;

    output.push(
      deepFreeze({
        bucket: point.bucket,
        value,
        missing: false,
        origin: ANALYTICS_POINT_ORIGIN.DERIVED,
        synthetic: false,
        derived: true,
        observationCount: kind === ANALYTICS_CUMULATIVE_KIND.COUNT ? runningCount : undefined,
      })
    );
  }

  return ok(
    deepFreeze({
      kind,
      points: Object.freeze(output),
      sourceSeriesId: series.seriesId,
      finalValue:
        kind === ANALYTICS_CUMULATIVE_KIND.SUM ? running : runningCount,
    })
  );
}
