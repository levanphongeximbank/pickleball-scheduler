/**
 * Deterministic threshold / state / trend / missing / freshness evaluators
 * (I&A-10). Never fills missing as zero. Never treats stale as fresh.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { ANALYTICS_TREND_DIRECTION } from "../historical-trend/enums.js";
import {
  deepFreeze,
  isFiniteNumber,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ALERT_THRESHOLD_OPERATOR,
  OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS,
  OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION,
  OPERATIONAL_SIGNAL_VALUE_KIND,
} from "./enums.js";

/**
 * @param {number} left
 * @param {string} operator
 * @param {number} right
 * @param {{ min?: number, max?: number }} [range]
 * @returns {boolean}
 */
function compareNumeric(left, operator, right, range) {
  switch (operator) {
    case ALERT_THRESHOLD_OPERATOR.GT:
      return left > right;
    case ALERT_THRESHOLD_OPERATOR.GTE:
      return left >= right;
    case ALERT_THRESHOLD_OPERATOR.LT:
      return left < right;
    case ALERT_THRESHOLD_OPERATOR.LTE:
      return left <= right;
    case ALERT_THRESHOLD_OPERATOR.EQ:
      return left === right;
    case ALERT_THRESHOLD_OPERATOR.NEQ:
      return left !== right;
    case ALERT_THRESHOLD_OPERATOR.INSIDE_RANGE:
      return left >= /** @type {number} */ (range?.min) &&
        left <= /** @type {number} */ (range?.max);
    case ALERT_THRESHOLD_OPERATOR.OUTSIDE_RANGE:
      return left < /** @type {number} */ (range?.min) ||
        left > /** @type {number} */ (range?.max);
    default:
      return false;
  }
}

/**
 * @param {unknown} signal
 * @param {unknown} condition
 * @param {unknown} rule
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateThresholdCondition(signal, condition, rule) {
  if (!isPlainObject(signal) || !isPlainObject(condition)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "threshold evaluation requires signal and condition",
        "threshold"
      )
    );
  }

  if (signal.missing === true) {
    return ok(
      deepFreeze({
        matched: false,
        skipped: true,
        reason: "missing_signal",
        methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.THRESHOLD,
      })
    );
  }

  if (
    condition.unit &&
    signal.unit &&
    String(condition.unit) !== String(signal.unit)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_UNIT_MISMATCH,
        "signal unit does not match threshold condition unit",
        "signal.unit",
        { signalUnit: signal.unit, conditionUnit: condition.unit }
      )
    );
  }
  if (
    rule &&
    isPlainObject(rule) &&
    rule.unit &&
    signal.unit &&
    String(rule.unit) !== String(signal.unit)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_UNIT_MISMATCH,
        "signal unit does not match rule unit",
        "signal.unit"
      )
    );
  }

  if (condition.valueKind === OPERATIONAL_SIGNAL_VALUE_KIND.MONEY) {
    const money = signal.value;
    const threshold = condition.threshold;
    if (!isPlainObject(money) || !isPlainObject(threshold)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
          "money threshold evaluation requires money values",
          "signal.value"
        )
      );
    }
    if (money.currencyCode !== threshold.currencyCode) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CURRENCY_MISMATCH,
          "cannot compare money across currencies",
          "signal.currencyCode",
          {
            signalCurrency: money.currencyCode,
            thresholdCurrency: threshold.currencyCode,
          }
        )
      );
    }
    if (
      !Number.isInteger(money.amountMinor) ||
      !Number.isFinite(money.amountMinor) ||
      !Number.isInteger(threshold.amountMinor) ||
      !Number.isFinite(threshold.amountMinor)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
          "money amounts must be finite integers",
          "signal.value.amountMinor"
        )
      );
    }
    const matched = compareNumeric(
      money.amountMinor,
      /** @type {string} */ (condition.operator),
      threshold.amountMinor
    );
    return ok(
      deepFreeze({
        matched,
        observedValue: money,
        threshold: condition.threshold,
        operator: condition.operator,
        methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.THRESHOLD,
      })
    );
  }

  if (!isFiniteNumber(signal.value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
        "numeric threshold evaluation requires a finite signal value",
        "signal.value"
      )
    );
  }

  if (
    condition.operator === ALERT_THRESHOLD_OPERATOR.INSIDE_RANGE ||
    condition.operator === ALERT_THRESHOLD_OPERATOR.OUTSIDE_RANGE
  ) {
    const matched = compareNumeric(
      signal.value,
      /** @type {string} */ (condition.operator),
      0,
      { min: condition.min, max: condition.max }
    );
    return ok(
      deepFreeze({
        matched,
        observedValue: signal.value,
        min: condition.min,
        max: condition.max,
        operator: condition.operator,
        methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.THRESHOLD,
      })
    );
  }

  if (!isFiniteNumber(condition.threshold)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
        "threshold must be finite",
        "condition.threshold"
      )
    );
  }

  const matched = compareNumeric(
    signal.value,
    /** @type {string} */ (condition.operator),
    condition.threshold
  );
  return ok(
    deepFreeze({
      matched,
      observedValue: signal.value,
      threshold: condition.threshold,
      operator: condition.operator,
      methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.THRESHOLD,
    })
  );
}

/**
 * @param {unknown} signal
 * @param {unknown} condition
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateStateCondition(signal, condition) {
  if (!isPlainObject(signal) || !isPlainObject(condition)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "state evaluation requires signal and condition",
        "state"
      )
    );
  }
  const state = String(signal.state || signal.sourceStatus || "");
  if (!state) {
    return ok(
      deepFreeze({
        matched: false,
        skipped: true,
        reason: "missing_state",
        methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.STATE,
      })
    );
  }

  let matched = false;
  if (condition.equals !== undefined) {
    matched = state === condition.equals;
  } else if (Array.isArray(condition.inSet)) {
    matched = condition.inSet.includes(state);
  } else if (Array.isArray(condition.notInSet)) {
    matched = !condition.notInSet.includes(state);
  }

  return ok(
    deepFreeze({
      matched,
      observedState: state,
      methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.STATE,
    })
  );
}

/**
 * @param {unknown} signal
 * @param {unknown} condition
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateTrendCondition(signal, condition) {
  if (!isPlainObject(signal) || !isPlainObject(condition)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "trend evaluation requires signal and condition",
        "trend"
      )
    );
  }

  const trend = signal.trend;
  if (!isPlainObject(trend)) {
    return ok(
      deepFreeze({
        matched: false,
        skipped: true,
        reason: "missing_trend",
        warningCode: "TREND_PAYLOAD_MISSING",
        methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.TREND,
      })
    );
  }

  const usablePointCount =
    typeof trend.usablePointCount === "number" ? trend.usablePointCount : 0;
  const coverageRate =
    typeof trend.coverageRate === "number" ? trend.coverageRate : 0;

  if (usablePointCount < condition.minimumPeriods) {
    return ok(
      deepFreeze({
        matched: false,
        skipped: true,
        reason: "insufficient_periods",
        warningCode: "INSUFFICIENT_TREND_PERIODS",
        usablePointCount,
        minimumPeriods: condition.minimumPeriods,
        methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.TREND,
      })
    );
  }

  if (coverageRate < condition.minimumCoverage) {
    return ok(
      deepFreeze({
        matched: false,
        skipped: true,
        reason: "insufficient_coverage",
        warningCode: "INSUFFICIENT_TREND_COVERAGE",
        coverageRate,
        minimumCoverage: condition.minimumCoverage,
        methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.TREND,
      })
    );
  }

  if (
    trend.direction === ANALYTICS_TREND_DIRECTION.INSUFFICIENT_DATA ||
    trend.direction === ANALYTICS_TREND_DIRECTION.INDETERMINATE
  ) {
    return ok(
      deepFreeze({
        matched: false,
        skipped: true,
        reason: "indeterminate_trend",
        warningCode: "INDETERMINATE_TREND",
        direction: trend.direction,
        methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.TREND,
      })
    );
  }

  const expected = String(condition.expectedDirection);
  const matched = String(trend.direction) === expected;

  if (
    condition.significanceThreshold !== undefined &&
    matched &&
    isFiniteNumber(trend.relativeChange)
  ) {
    if (Math.abs(trend.relativeChange) < condition.significanceThreshold) {
      return ok(
        deepFreeze({
          matched: false,
          skipped: true,
          reason: "below_significance_threshold",
          direction: trend.direction,
          relativeChange: trend.relativeChange,
          methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.TREND,
        })
      );
    }
  }

  return ok(
    deepFreeze({
      matched,
      direction: trend.direction,
      expectedDirection: expected,
      absoluteChange: trend.absoluteChange,
      relativeChange: trend.relativeChange,
      usablePointCount,
      coverageRate,
      trendMethodVersion: condition.trendMethodVersion,
      methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.TREND,
    })
  );
}

/**
 * @param {unknown} signal
 * @param {unknown} condition
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateMissingDataCondition(signal, condition) {
  if (!isPlainObject(condition)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "missing-data condition required",
        "missingData"
      )
    );
  }

  const missing = !signal || signal.missing === true;
  const incomplete =
    isPlainObject(signal) &&
    (signal.completeness === OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.PARTIAL ||
      signal.completeness === OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.UNKNOWN);
  const sourceFailure = isPlainObject(signal) && signal.sourceFailure === true;

  let matched = false;
  let reason = "not_matched";
  if (condition.alertOnSourceFailure && sourceFailure) {
    matched = true;
    reason = "source_failure";
  } else if (condition.alertOnMissing && missing) {
    matched = true;
    reason = "missing_signal";
  } else if (condition.alertOnIncomplete && incomplete) {
    matched = true;
    reason = "incomplete_snapshot";
  }

  return ok(
    deepFreeze({
      matched,
      reason,
      missing,
      incomplete,
      sourceFailure,
      neverFillZero: condition.neverFillZero !== false,
      filledAsZero: false,
      methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.MISSING_DATA,
    })
  );
}

/**
 * @param {unknown} signal
 * @param {unknown} condition
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateFreshnessCondition(signal, condition) {
  if (!isPlainObject(signal) || !isPlainObject(condition)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "freshness evaluation requires signal and condition",
        "freshness"
      )
    );
  }

  const freshness = signal.freshness;
  let matched = false;
  let reason = "not_matched";
  if (condition.alertOnStale && freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
    matched = true;
    reason = "stale_signal";
  } else if (
    condition.alertOnUnknown &&
    freshness === ANALYTICS_FRESHNESS_STATE.UNKNOWN
  ) {
    matched = true;
    reason = "unknown_freshness";
  }

  return ok(
    deepFreeze({
      matched,
      reason,
      freshness,
      treatedAsFresh: false,
      methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.FRESHNESS,
    })
  );
}
