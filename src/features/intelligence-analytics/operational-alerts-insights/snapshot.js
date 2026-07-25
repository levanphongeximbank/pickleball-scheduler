/**
 * Operational signals snapshot envelope (I&A-10).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { createAlertEvaluationContext } from "./context.js";
import {
  OPERATIONAL_ALERTS_INSIGHTS_COMPLETENESS,
  isOperationalAlertsInsightsEnumValue,
} from "./enums.js";
import { createOperationalSignal } from "./signals.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalSignalsSnapshot(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SNAPSHOT_INVALID,
        "OperationalSignalsSnapshot must be a plain object",
        "snapshot"
      )
    );
  }

  const contextResult = createAlertEvaluationContext(
    input.context || { tenantScope: input.tenantScope }
  );
  if (!contextResult.ok) return contextResult;
  const context = contextResult.value;

  /** @type {unknown[]} */
  const signals = [];
  if (input.signals !== undefined) {
    if (!Array.isArray(input.signals)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SNAPSHOT_INVALID,
          "signals must be an array",
          "signals"
        )
      );
    }
    for (let i = 0; i < input.signals.length; i += 1) {
      const created = createOperationalSignal(input.signals[i]);
      if (!created.ok) {
        return fail(
          analyticsError(
            created.error.code || ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
            created.error.message,
            `signals[${i}]`,
            created.error.details
          )
        );
      }
      signals.push(created.value);
    }
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

  if (
    input.sourceTimestamp !== undefined &&
    !isValidIsoTimestamp(input.sourceTimestamp)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TIMESTAMP_INVALID,
        "sourceTimestamp must be a valid ISO timestamp",
        "sourceTimestamp"
      )
    );
  }

  /** @type {unknown[]} */
  const warnings = [];
  if (Array.isArray(input.warnings)) {
    for (const warning of input.warnings) {
      const created = createAnalyticsWarning(warning);
      if (!created.ok) return created;
      warnings.push(created.value);
    }
  }

  /** @type {Record<string, unknown>} */
  const snapshot = {
    context,
    signals: Object.freeze(signals),
    provenance,
    freshness,
    completeness,
    warnings: Object.freeze(warnings),
    isCanonicalDomainState: false,
    isDeliveredNotification: false,
    isCanonicalModuleState: false,
  };

  if (input.sourceTimestamp !== undefined) {
    snapshot.sourceTimestamp = String(input.sourceTimestamp).trim();
  }
  if (isNonEmptyString(input.canonicalSourceRef)) {
    snapshot.canonicalSourceRef = String(input.canonicalSourceRef).trim();
  }

  return ok(deepFreeze(clonePlain(snapshot)));
}
