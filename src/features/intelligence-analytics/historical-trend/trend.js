/**
 * Deterministic trend direction / strength classification (I&A-05).
 *
 * Method (documented, non-ML):
 * 1. Collect finite non-missing observed (or filled if includeSynthetic) values in order.
 * 2. If usable points < 2 → INSUFFICIENT_DATA / strength NONE.
 * 3. Compute first-to-last absolute + relative change.
 * 4. Compute monotonic step ratio and normalized slope.
 * 5. If coefficient of variation high and direction flips often → VOLATILE.
 * 6. Else classify INCREASING / DECREASING / STABLE by thresholds.
 *
 * No forecasting, causal inference, or recommendations.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isFiniteNumber,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_TREND_DIRECTION,
  ANALYTICS_TREND_STRENGTH,
} from "./enums.js";

const METHOD_ID = "ia05.first_last_monotonic_cv_v1";

/**
 * @param {ReadonlyArray<number>} values
 */
function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * @param {ReadonlyArray<number>} values
 */
function stdev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function analyzeTrend(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_TREND_INVALID,
        "analyzeTrend requires a plain object",
        "trend"
      )
    );
  }

  /** @type {number[]} */
  let values = [];
  if (Array.isArray(input.values)) {
    for (const v of input.values) {
      if (v === null || v === undefined) continue;
      if (!isFiniteNumber(v)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT,
            "Trend values must be finite numbers when present",
            "trend.values"
          )
        );
      }
      values.push(v);
    }
  } else if (isPlainObject(input.series) && Array.isArray(input.series.points)) {
    const includeSynthetic = Boolean(input.includeSynthetic);
    for (const point of input.series.points) {
      if (!isPlainObject(point)) continue;
      if (point.missing) continue;
      if (point.synthetic && !includeSynthetic) continue;
      if (!isFiniteNumber(point.value)) continue;
      values.push(point.value);
    }
  } else {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_TREND_INVALID,
        "analyzeTrend requires values[] or series.points",
        "trend"
      )
    );
  }

  const stableRelativeThreshold =
    isFiniteNumber(input.stableRelativeThreshold) && input.stableRelativeThreshold >= 0
      ? input.stableRelativeThreshold
      : 0.02;
  const volatileCvThreshold =
    isFiniteNumber(input.volatileCvThreshold) && input.volatileCvThreshold > 0
      ? input.volatileCvThreshold
      : 0.35;
  const strongRelativeThreshold =
    isFiniteNumber(input.strongRelativeThreshold) && input.strongRelativeThreshold > 0
      ? input.strongRelativeThreshold
      : 0.2;

  if (values.length < 2) {
    return ok(
      deepFreeze({
        direction: ANALYTICS_TREND_DIRECTION.INSUFFICIENT_DATA,
        strength: ANALYTICS_TREND_STRENGTH.NONE,
        method: METHOD_ID,
        usablePointCount: values.length,
        firstValue: values[0] ?? null,
        lastValue: values[0] ?? null,
        absoluteChange: null,
        relativeChange: null,
        monotonicRatio: null,
        normalizedSlope: null,
        coefficientOfVariation: null,
      })
    );
  }

  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const absoluteChange = lastValue - firstValue;
  const relativeChange =
    firstValue === 0 ? null : absoluteChange / firstValue;

  let up = 0;
  let down = 0;
  for (let i = 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta > 0) up += 1;
    else if (delta < 0) down += 1;
  }
  const steps = values.length - 1;
  const monotonicRatio = Math.max(up, down) / steps;
  const directionFlipRatio = Math.min(up, down) / steps;

  const m = mean(values);
  const sd = stdev(values);
  const coefficientOfVariation = m === 0 ? (sd === 0 ? 0 : Number.POSITIVE_INFINITY) : Math.abs(sd / m);
  // Cap CV used for classification (never emit Infinity in result).
  const cvForResult = Number.isFinite(coefficientOfVariation)
    ? coefficientOfVariation
    : null;

  const span = values.length - 1;
  const normalizedSlope = absoluteChange / span / (Math.abs(m) > 1e-12 ? Math.abs(m) : 1);

  const relAbs =
    relativeChange === null ? Math.abs(normalizedSlope) : Math.abs(relativeChange);

  /** @type {string} */
  let direction;
  /** @type {string} */
  let strength;

  if (
    directionFlipRatio >= 0.35 &&
    (cvForResult === null || cvForResult >= volatileCvThreshold)
  ) {
    direction = ANALYTICS_TREND_DIRECTION.VOLATILE;
    strength = ANALYTICS_TREND_STRENGTH.MODERATE;
  } else if (
    relativeChange === null
      ? Math.abs(absoluteChange) <= Math.abs(m) * stableRelativeThreshold ||
        (Math.abs(absoluteChange) === 0 && sd === 0)
      : Math.abs(relativeChange) <= stableRelativeThreshold
  ) {
    // Near-flat overall change.
    if (directionFlipRatio >= 0.35 && sd > 0) {
      direction = ANALYTICS_TREND_DIRECTION.VOLATILE;
      strength = ANALYTICS_TREND_STRENGTH.WEAK;
    } else {
      direction = ANALYTICS_TREND_DIRECTION.STABLE;
      strength =
        sd === 0 ? ANALYTICS_TREND_STRENGTH.STRONG : ANALYTICS_TREND_STRENGTH.MODERATE;
    }
  } else if (absoluteChange > 0) {
    direction = ANALYTICS_TREND_DIRECTION.INCREASING;
    strength =
      relAbs >= strongRelativeThreshold && monotonicRatio >= 0.66
        ? ANALYTICS_TREND_STRENGTH.STRONG
        : relAbs >= strongRelativeThreshold / 2 || monotonicRatio >= 0.5
          ? ANALYTICS_TREND_STRENGTH.MODERATE
          : ANALYTICS_TREND_STRENGTH.WEAK;
  } else if (absoluteChange < 0) {
    direction = ANALYTICS_TREND_DIRECTION.DECREASING;
    strength =
      relAbs >= strongRelativeThreshold && monotonicRatio >= 0.66
        ? ANALYTICS_TREND_STRENGTH.STRONG
        : relAbs >= strongRelativeThreshold / 2 || monotonicRatio >= 0.5
          ? ANALYTICS_TREND_STRENGTH.MODERATE
          : ANALYTICS_TREND_STRENGTH.WEAK;
  } else {
    direction = ANALYTICS_TREND_DIRECTION.STABLE;
    strength = ANALYTICS_TREND_STRENGTH.NONE;
  }

  return ok(
    deepFreeze({
      direction,
      strength,
      method: METHOD_ID,
      usablePointCount: values.length,
      firstValue,
      lastValue,
      absoluteChange,
      relativeChange,
      monotonicRatio,
      normalizedSlope,
      coefficientOfVariation: cvForResult,
      thresholds: deepFreeze({
        stableRelativeThreshold,
        volatileCvThreshold,
        strongRelativeThreshold,
      }),
    })
  );
}
