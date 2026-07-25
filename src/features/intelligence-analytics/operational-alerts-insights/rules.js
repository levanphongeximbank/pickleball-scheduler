/**
 * Alert / insight condition and rule definition contracts (I&A-10).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ALERT_EVALUATION_TYPE,
  ALERT_SEVERITY,
  ALERT_THRESHOLD_OPERATOR,
  MISSING_SIGNAL_POLICY,
  OPERATIONAL_SIGNAL_DOMAIN,
  OPERATIONAL_SIGNAL_VALUE_KIND,
  RESULT_KIND,
  STALE_SIGNAL_POLICY,
  isOperationalAlertsInsightsEnumValue,
} from "./enums.js";
import {
  createAlertCooldownPolicy,
  createAlertDeduplicationPolicy,
  createAlertResolutionPolicy,
  createAlertSuppressionPolicy,
} from "./policies.js";
import { rejectForbiddenOperationalAlertFields } from "./privacy.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertThresholdCondition(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "AlertThresholdCondition must be a plain object",
        "thresholdCondition"
      )
    );
  }
  if (
    !isOperationalAlertsInsightsEnumValue(
      input.operator,
      ALERT_THRESHOLD_OPERATOR
    )
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
        "threshold operator is invalid",
        "thresholdCondition.operator"
      )
    );
  }

  const valueKind = isOperationalAlertsInsightsEnumValue(
    input.valueKind,
    OPERATIONAL_SIGNAL_VALUE_KIND
  )
    ? /** @type {string} */ (input.valueKind)
    : OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER;

  /** @type {Record<string, unknown>} */
  const condition = {
    kind: ALERT_EVALUATION_TYPE.THRESHOLD,
    operator: input.operator,
    valueKind,
  };

  if (
    input.operator === ALERT_THRESHOLD_OPERATOR.INSIDE_RANGE ||
    input.operator === ALERT_THRESHOLD_OPERATOR.OUTSIDE_RANGE
  ) {
    if (!isFiniteNumber(input.min) || !isFiniteNumber(input.max)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
          "range threshold requires finite min and max",
          "thresholdCondition.range"
        )
      );
    }
    if (input.min > input.max) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
          "range threshold min must be <= max",
          "thresholdCondition.range"
        )
      );
    }
    condition.min = input.min;
    condition.max = input.max;
  } else if (valueKind === OPERATIONAL_SIGNAL_VALUE_KIND.MONEY) {
    if (!isPlainObject(input.threshold) || !isNonEmptyString(input.threshold.currencyCode)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CURRENCY_MISMATCH,
          "money threshold requires currencyCode and amountMinor",
          "thresholdCondition.threshold"
        )
      );
    }
    if (
      typeof input.threshold.amountMinor !== "number" ||
      !Number.isInteger(input.threshold.amountMinor) ||
      !Number.isFinite(input.threshold.amountMinor)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
          "money threshold amountMinor must be a finite integer",
          "thresholdCondition.threshold.amountMinor"
        )
      );
    }
    condition.threshold = deepFreeze({
      currencyCode: String(input.threshold.currencyCode).trim().toUpperCase(),
      amountMinor: input.threshold.amountMinor,
    });
  } else {
    if (!isFiniteNumber(input.threshold)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
          "threshold must be a finite number (NaN/Infinity rejected)",
          "thresholdCondition.threshold"
        )
      );
    }
    if (
      valueKind === OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE &&
      (input.threshold < 0 || input.threshold > 1)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
          "percentage threshold must be in [0, 1]",
          "thresholdCondition.threshold"
        )
      );
    }
    condition.threshold = input.threshold;
  }

  if (isNonEmptyString(input.unit)) {
    condition.unit = String(input.unit).trim();
  }
  if (isNonEmptyString(input.currencyCode)) {
    condition.currencyCode = String(input.currencyCode).trim().toUpperCase();
  }

  return ok(deepFreeze(condition));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertStateCondition(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "AlertStateCondition must be a plain object",
        "stateCondition"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const condition = {
    kind: ALERT_EVALUATION_TYPE.STATE,
  };

  if (isNonEmptyString(input.equals)) {
    condition.equals = String(input.equals).trim();
  }
  if (Array.isArray(input.inSet)) {
    condition.inSet = Object.freeze(
      input.inSet.map((v) => String(v).trim()).filter(Boolean)
    );
  }
  if (Array.isArray(input.notInSet)) {
    condition.notInSet = Object.freeze(
      input.notInSet.map((v) => String(v).trim()).filter(Boolean)
    );
  }
  if (
    condition.equals === undefined &&
    condition.inSet === undefined &&
    condition.notInSet === undefined
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "state condition requires equals, inSet, or notInSet",
        "stateCondition"
      )
    );
  }
  return ok(deepFreeze(condition));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertTrendCondition(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "AlertTrendCondition must be a plain object",
        "trendCondition"
      )
    );
  }
  if (!isNonEmptyString(input.expectedDirection)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "trend condition requires expectedDirection",
        "trendCondition.expectedDirection"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const condition = {
    kind: ALERT_EVALUATION_TYPE.TREND,
    expectedDirection: String(input.expectedDirection).trim(),
    minimumPeriods:
      Number.isInteger(input.minimumPeriods) && input.minimumPeriods > 0
        ? input.minimumPeriods
        : 2,
    minimumCoverage:
      isFiniteNumber(input.minimumCoverage) ? input.minimumCoverage : 0.5,
    comparisonMethod: isNonEmptyString(input.comparisonMethod)
      ? String(input.comparisonMethod).trim()
      : "ia05.first_last_monotonic_cv_v1",
    trendMethodVersion: isNonEmptyString(input.trendMethodVersion)
      ? String(input.trendMethodVersion).trim()
      : "ia05.first_last_monotonic_cv_v1",
    insufficientPeriodsPolicy: isNonEmptyString(input.insufficientPeriodsPolicy)
      ? String(input.insufficientPeriodsPolicy).trim()
      : "warn_no_alert",
    missingPeriodPolicy: isNonEmptyString(input.missingPeriodPolicy)
      ? String(input.missingPeriodPolicy).trim()
      : "preserve_missing",
  };

  if (input.significanceThreshold !== undefined) {
    if (!isFiniteNumber(input.significanceThreshold)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
          "significanceThreshold must be finite when provided",
          "trendCondition.significanceThreshold"
        )
      );
    }
    condition.significanceThreshold = input.significanceThreshold;
  }

  return ok(deepFreeze(condition));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertFreshnessCondition(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "AlertFreshnessCondition must be a plain object",
        "freshnessCondition"
      )
    );
  }
  return ok(
    deepFreeze({
      kind: ALERT_EVALUATION_TYPE.FRESHNESS,
      alertOnStale: input.alertOnStale !== false,
      alertOnUnknown: input.alertOnUnknown === true,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertMissingDataCondition(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
        "AlertMissingDataCondition must be a plain object",
        "missingDataCondition"
      )
    );
  }
  return ok(
    deepFreeze({
      kind: ALERT_EVALUATION_TYPE.MISSING_DATA,
      alertOnMissing: input.alertOnMissing !== false,
      alertOnIncomplete: input.alertOnIncomplete !== false,
      alertOnSourceFailure: input.alertOnSourceFailure !== false,
      neverFillZero: input.neverFillZero !== false,
    })
  );
}

/**
 * @param {unknown} conditionInput
 * @param {string} evaluationType
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeCondition(conditionInput, evaluationType) {
  if (evaluationType === ALERT_EVALUATION_TYPE.THRESHOLD) {
    return createAlertThresholdCondition(conditionInput || {});
  }
  if (evaluationType === ALERT_EVALUATION_TYPE.STATE) {
    return createAlertStateCondition(conditionInput || {});
  }
  if (evaluationType === ALERT_EVALUATION_TYPE.TREND) {
    return createAlertTrendCondition(conditionInput || {});
  }
  if (evaluationType === ALERT_EVALUATION_TYPE.FRESHNESS) {
    return createAlertFreshnessCondition(conditionInput || {});
  }
  if (
    evaluationType === ALERT_EVALUATION_TYPE.MISSING_DATA ||
    evaluationType === ALERT_EVALUATION_TYPE.SOURCE_FAILURE
  ) {
    return createAlertMissingDataCondition(conditionInput || {});
  }
  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONDITION_INVALID,
      `unsupported evaluation type: ${evaluationType}`,
      "evaluationType"
    )
  );
}

/**
 * @param {unknown} input
 * @param {string} resultKind
 * @returns {import("../contracts/result.js").Result}
 */
function createRuleDefinition(input, resultKind) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "Rule definition must be a plain object",
        "rule"
      )
    );
  }
  const privacyReject = rejectForbiddenOperationalAlertFields(input, "rule");
  if (privacyReject) return privacyReject;

  if (!isNonEmptyString(input.ruleId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "ruleId is required",
        "rule.ruleId"
      )
    );
  }
  if (!isNonEmptyString(input.ruleVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "ruleVersion is required",
        "rule.ruleVersion"
      )
    );
  }
  if (!isNonEmptyString(input.title)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "title is required",
        "rule.title"
      )
    );
  }
  if (
    !isOperationalAlertsInsightsEnumValue(
      input.evaluationType,
      ALERT_EVALUATION_TYPE
    )
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "evaluationType is invalid",
        "rule.evaluationType"
      )
    );
  }
  if (!isOperationalAlertsInsightsEnumValue(input.severity, ALERT_SEVERITY)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "severity is required and must use ALERT_SEVERITY",
        "rule.severity"
      )
    );
  }
  if (
    !isOperationalAlertsInsightsEnumValue(input.domain, OPERATIONAL_SIGNAL_DOMAIN)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "domain is required",
        "rule.domain"
      )
    );
  }
  if (!isNonEmptyString(input.metricId) || !isNonEmptyString(input.metricVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "metricId and metricVersion are required",
        "rule.metricId"
      )
    );
  }

  const conditionResult = normalizeCondition(
    input.condition,
    /** @type {string} */ (input.evaluationType)
  );
  if (!conditionResult.ok) return conditionResult;

  const dedupResult = createAlertDeduplicationPolicy(input.deduplicationPolicy || {});
  if (!dedupResult.ok) return dedupResult;
  const cooldownResult = createAlertCooldownPolicy(
    input.cooldownPolicy || { durationMs: 3600000 }
  );
  if (!cooldownResult.ok) return cooldownResult;
  const suppressionResult = createAlertSuppressionPolicy(
    input.suppressionPolicy || {}
  );
  if (!suppressionResult.ok) return suppressionResult;
  const resolutionResult = createAlertResolutionPolicy(
    input.resolutionPolicy || {}
  );
  if (!resolutionResult.ok) return resolutionResult;

  const defaultMissingPolicy =
    input.evaluationType === ALERT_EVALUATION_TYPE.MISSING_DATA ||
    input.evaluationType === ALERT_EVALUATION_TYPE.SOURCE_FAILURE ||
    input.evaluationType === ALERT_EVALUATION_TYPE.FRESHNESS
      ? MISSING_SIGNAL_POLICY.ALERT
      : MISSING_SIGNAL_POLICY.SKIP;

  const missingDataPolicy = isOperationalAlertsInsightsEnumValue(
    input.missingDataPolicy,
    MISSING_SIGNAL_POLICY
  )
    ? /** @type {string} */ (input.missingDataPolicy)
    : defaultMissingPolicy;

  const staleDataPolicy = isOperationalAlertsInsightsEnumValue(
    input.staleDataPolicy,
    STALE_SIGNAL_POLICY
  )
    ? /** @type {string} */ (input.staleDataPolicy)
    : STALE_SIGNAL_POLICY.WARN;

  /** @type {Record<string, unknown>} */
  const rule = {
    ruleId: String(input.ruleId).trim(),
    ruleVersion: String(input.ruleVersion).trim(),
    title: String(input.title).trim(),
    description: isNonEmptyString(input.description)
      ? String(input.description).trim()
      : String(input.title).trim(),
    resultKind,
    evaluationType: input.evaluationType,
    severity: input.severity,
    domain: input.domain,
    metricId: String(input.metricId).trim(),
    metricVersion: String(input.metricVersion).trim(),
    signalId: isNonEmptyString(input.signalId)
      ? String(input.signalId).trim()
      : String(input.metricId).trim(),
    signalVersion: isNonEmptyString(input.signalVersion)
      ? String(input.signalVersion).trim()
      : String(input.metricVersion).trim(),
    condition: conditionResult.value,
    missingDataPolicy,
    staleDataPolicy,
    deduplicationPolicy: dedupResult.value,
    cooldownPolicy: deepFreeze({
      ...cooldownResult.value,
      ruleVersion: String(input.ruleVersion).trim(),
    }),
    suppressionPolicy: suppressionResult.value,
    resolutionPolicy: resolutionResult.value,
    explanationTemplate: isNonEmptyString(input.explanationTemplate)
      ? String(input.explanationTemplate).trim()
      : "{title}: condition matched for {metricId}",
    enabledByDefault: input.enabledByDefault !== false,
    allowedEntityKeys: Array.isArray(input.allowedEntityKeys)
      ? Object.freeze(input.allowedEntityKeys.map((k) => String(k)))
      : Object.freeze([]),
  };

  if (isNonEmptyString(input.unit)) rule.unit = String(input.unit).trim();
  if (isNonEmptyString(input.currencyCode)) {
    rule.currencyCode = String(input.currencyCode).trim().toUpperCase();
  }
  if (isNonEmptyString(input.correlationGroup)) {
    rule.correlationGroup = String(input.correlationGroup).trim();
  }

  return ok(deepFreeze(rule));
}

/**
 * @param {unknown} input
 */
export function createOperationalAlertRule(input) {
  return createRuleDefinition(input, RESULT_KIND.ALERT);
}

/**
 * @param {unknown} input
 */
export function createOperationalInsightRule(input) {
  return createRuleDefinition(input, RESULT_KIND.INSIGHT);
}
