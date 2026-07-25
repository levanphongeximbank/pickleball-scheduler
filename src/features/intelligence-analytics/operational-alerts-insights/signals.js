/**
 * Operational signal contracts (I&A-10). Immutable analytical signals that
 * reference merged I&A metric identities — never raw DB rows, React state,
 * PII, or executable callbacks.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import { createAnalyticsTimeWindow } from "../contracts/timeWindow.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS,
  OPERATIONAL_SIGNAL_DOMAIN,
  OPERATIONAL_SIGNAL_VALUE_KIND,
  isOperationalAlertsInsightsEnumValue,
} from "./enums.js";
import { rejectForbiddenOperationalAlertFields } from "./privacy.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalSignalIdentity(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "OperationalSignalIdentity must be a plain object",
        "signalIdentity"
      )
    );
  }
  if (!isNonEmptyString(input.signalId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "signalId is required",
        "signalIdentity.signalId"
      )
    );
  }
  if (!isNonEmptyString(input.signalVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "signalVersion is required",
        "signalIdentity.signalVersion"
      )
    );
  }
  return ok(
    deepFreeze({
      signalId: String(input.signalId).trim(),
      signalVersion: String(input.signalVersion).trim(),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeEntityScope(input) {
  if (input === undefined) {
    return ok(deepFreeze({}));
  }
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "entityScope must be a plain object",
        "entityScope"
      )
    );
  }
  const privacyReject = rejectForbiddenOperationalAlertFields(input, "entityScope");
  if (privacyReject) return privacyReject;

  /** @type {Record<string, string>} */
  const scope = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isNonEmptyString(value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
          `entityScope.${key} must be a non-empty string`,
          `entityScope.${key}`
        )
      );
    }
    scope[key] = String(value).trim();
  }
  return ok(deepFreeze(scope));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeMoneyValue(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "money value must be { currencyCode, amountMinor }",
        "value"
      )
    );
  }
  if (!isNonEmptyString(input.currencyCode)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CURRENCY_MISMATCH,
        "money value requires currencyCode",
        "value.currencyCode"
      )
    );
  }
  if (
    typeof input.amountMinor !== "number" ||
    !Number.isInteger(input.amountMinor) ||
    !Number.isFinite(input.amountMinor)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
        "money amountMinor must be a finite integer",
        "value.amountMinor"
      )
    );
  }
  return ok(
    deepFreeze({
      currencyCode: String(input.currencyCode).trim().toUpperCase(),
      amountMinor: input.amountMinor,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeTrendPayload(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "trend payload must be a plain object",
        "trend"
      )
    );
  }
  if (!isNonEmptyString(input.direction)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "trend.direction is required",
        "trend.direction"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const trend = {
    direction: String(input.direction).trim(),
  };
  if (input.strength !== undefined) trend.strength = String(input.strength);
  if (input.method !== undefined) trend.method = String(input.method);
  if (input.usablePointCount !== undefined) {
    if (!Number.isInteger(input.usablePointCount) || input.usablePointCount < 0) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
          "trend.usablePointCount must be a non-negative integer",
          "trend.usablePointCount"
        )
      );
    }
    trend.usablePointCount = input.usablePointCount;
  }
  if (input.coverageRate !== undefined) {
    if (!isFiniteNumber(input.coverageRate)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
          "trend.coverageRate must be a finite number",
          "trend.coverageRate"
        )
      );
    }
    trend.coverageRate = input.coverageRate;
  }
  if (input.absoluteChange !== undefined) {
    if (!isFiniteNumber(input.absoluteChange)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
          "trend.absoluteChange must be finite",
          "trend.absoluteChange"
        )
      );
    }
    trend.absoluteChange = input.absoluteChange;
  }
  if (input.relativeChange !== undefined) {
    if (!isFiniteNumber(input.relativeChange)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
          "trend.relativeChange must be finite",
          "trend.relativeChange"
        )
      );
    }
    trend.relativeChange = input.relativeChange;
  }
  if (input.firstValue !== undefined && isFiniteNumber(input.firstValue)) {
    trend.firstValue = input.firstValue;
  }
  if (input.lastValue !== undefined && isFiniteNumber(input.lastValue)) {
    trend.lastValue = input.lastValue;
  }
  return ok(deepFreeze(trend));
}

/**
 * Create an immutable OperationalSignal.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalSignal(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "OperationalSignal must be a plain object",
        "signal"
      )
    );
  }

  const privacyReject = rejectForbiddenOperationalAlertFields(input, "signal");
  if (privacyReject) return privacyReject;

  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "OperationalSignal.tenantId is required",
        "signal.tenantId"
      )
    );
  }

  const identityResult = createOperationalSignalIdentity(
    input.signalIdentity || {
      signalId: input.signalId,
      signalVersion: input.signalVersion,
    }
  );
  if (!identityResult.ok) return identityResult;

  if (!isNonEmptyString(input.metricId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "metricId is required",
        "signal.metricId"
      )
    );
  }
  if (!isNonEmptyString(input.metricVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "metricVersion is required",
        "signal.metricVersion"
      )
    );
  }

  if (
    !isOperationalAlertsInsightsEnumValue(input.domain, OPERATIONAL_SIGNAL_DOMAIN)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "domain must be a known OPERATIONAL_SIGNAL_DOMAIN value",
        "signal.domain"
      )
    );
  }

  const valueKind = isOperationalAlertsInsightsEnumValue(
    input.valueKind,
    OPERATIONAL_SIGNAL_VALUE_KIND
  )
    ? /** @type {string} */ (input.valueKind)
    : OPERATIONAL_SIGNAL_VALUE_KIND.NUMBER;

  const entityScopeResult = normalizeEntityScope(input.entityScope);
  if (!entityScopeResult.ok) return entityScopeResult;

  let timeWindow;
  if (input.timeWindow !== undefined) {
    const tw = createAnalyticsTimeWindow(input.timeWindow);
    if (!tw.ok) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
          tw.error.message,
          "signal.timeWindow",
          tw.error.details
        )
      );
    }
    timeWindow = tw.value;
  }

  if (input.observedAt !== undefined && !isValidIsoTimestamp(input.observedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TIMESTAMP_INVALID,
        "observedAt must be a valid ISO timestamp",
        "signal.observedAt"
      )
    );
  }
  if (
    input.sourceTimestamp !== undefined &&
    !isValidIsoTimestamp(input.sourceTimestamp)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TIMESTAMP_INVALID,
        "sourceTimestamp must be a valid ISO timestamp",
        "signal.sourceTimestamp"
      )
    );
  }

  let provenance;
  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    provenance = provenanceResult.value;
  } else {
    const provenanceResult = createAnalyticsMetricProvenance({
      source: {
        sourceId: "operational-alerts-insights-explicit",
        sourceKind: "explicit_input",
        ownerModule: "intelligence-analytics",
        reference: "ia-10-certification",
      },
    });
    if (!provenanceResult.ok) return provenanceResult;
    provenance = provenanceResult.value;
  }

  const freshness = Object.values(ANALYTICS_FRESHNESS_STATE).includes(
    /** @type {string} */ (input.freshness)
  )
    ? /** @type {string} */ (input.freshness)
    : ANALYTICS_FRESHNESS_STATE.FRESH;

  const completeness = isOperationalAlertsInsightsEnumValue(
    input.completeness,
    OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS
  )
    ? /** @type {string} */ (input.completeness)
    : OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS.COMPLETE;

  /** @type {Record<string, unknown>} */
  const signal = {
    tenantId: String(input.tenantId).trim(),
    signalIdentity: identityResult.value,
    metricId: String(input.metricId).trim(),
    metricVersion: String(input.metricVersion).trim(),
    domain: input.domain,
    valueKind,
    entityScope: entityScopeResult.value,
    provenance,
    freshness,
    completeness,
    isCanonicalDomainState: false,
    isDeliveredNotification: false,
  };

  if (timeWindow) signal.timeWindow = timeWindow;
  if (input.observedAt !== undefined) {
    signal.observedAt = String(input.observedAt).trim();
  }
  if (input.sourceTimestamp !== undefined) {
    signal.sourceTimestamp = String(input.sourceTimestamp).trim();
  }
  if (isNonEmptyString(input.unit)) {
    signal.unit = String(input.unit).trim();
  }
  if (isNonEmptyString(input.currencyCode)) {
    signal.currencyCode = String(input.currencyCode).trim().toUpperCase();
  }
  if (isNonEmptyString(input.sourceStatus)) {
    signal.sourceStatus = String(input.sourceStatus).trim();
  }
  if (isNonEmptyString(input.state)) {
    signal.state = String(input.state).trim();
  }
  if (input.missing === true) {
    signal.missing = true;
    signal.valueKind = OPERATIONAL_SIGNAL_VALUE_KIND.ABSENT;
  }
  if (input.sourceFailure === true) {
    signal.sourceFailure = true;
  }
  if (isFiniteNumber(input.coverageRate)) {
    signal.coverageRate = input.coverageRate;
  }

  if (valueKind === OPERATIONAL_SIGNAL_VALUE_KIND.MONEY) {
    const moneyResult = normalizeMoneyValue(input.value);
    if (!moneyResult.ok) return moneyResult;
    signal.value = moneyResult.value;
    signal.currencyCode = moneyResult.value.currencyCode;
  } else if (valueKind === OPERATIONAL_SIGNAL_VALUE_KIND.TREND) {
    const trendResult = normalizeTrendPayload(input.trend || input.value);
    if (!trendResult.ok) return trendResult;
    signal.trend = trendResult.value;
  } else if (valueKind === OPERATIONAL_SIGNAL_VALUE_KIND.STATE) {
    if (!isNonEmptyString(input.state) && !isNonEmptyString(input.value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
          "state signal requires state or value string",
          "signal.state"
        )
      );
    }
    signal.state = String(input.state || input.value).trim();
  } else if (valueKind === OPERATIONAL_SIGNAL_VALUE_KIND.BOOLEAN) {
    if (typeof input.value !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
          "boolean signal requires boolean value",
          "signal.value"
        )
      );
    }
    signal.value = input.value;
  } else if (valueKind === OPERATIONAL_SIGNAL_VALUE_KIND.ABSENT || input.missing) {
    signal.missing = true;
  } else if (input.value !== undefined) {
    if (!isFiniteNumber(input.value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
          "numeric/percentage signal value must be a finite number (NaN/Infinity rejected)",
          "signal.value"
        )
      );
    }
    if (valueKind === OPERATIONAL_SIGNAL_VALUE_KIND.PERCENTAGE) {
      if (input.value < 0 || input.value > 1) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_THRESHOLD_INVALID,
            "percentage signal value must be in [0, 1]",
            "signal.value"
          )
        );
      }
    }
    signal.value = input.value;
  }

  if (input.trend !== undefined && valueKind !== OPERATIONAL_SIGNAL_VALUE_KIND.TREND) {
    const trendResult = normalizeTrendPayload(input.trend);
    if (!trendResult.ok) return trendResult;
    signal.trend = trendResult.value;
  }

  return ok(deepFreeze(signal));
}
