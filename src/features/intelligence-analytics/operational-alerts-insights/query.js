/**
 * Operational alerts / insights query descriptor (I&A-10).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsTimeWindow } from "../contracts/timeWindow.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";
import { createAlertEvaluationContext } from "./context.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalAlertsInsightsQuery(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
        "OperationalAlertsInsightsQuery must be a plain object",
        "query"
      )
    );
  }

  const contextResult = createAlertEvaluationContext(
    input.context || { tenantScope: input.tenantScope }
  );
  if (!contextResult.ok) return contextResult;

  /** @type {Record<string, unknown>} */
  const query = {
    context: contextResult.value,
    includeDashboardPayloads: input.includeDashboardPayloads === true,
    includeNotificationCandidates: input.includeNotificationCandidates === true,
  };

  if (input.timeWindow !== undefined) {
    const timeWindowResult = createAnalyticsTimeWindow(input.timeWindow);
    if (!timeWindowResult.ok) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
          timeWindowResult.error.message,
          "query.timeWindow",
          timeWindowResult.error.details
        )
      );
    }
    query.timeWindow = timeWindowResult.value;
  }

  if (input.ruleIds !== undefined) {
    if (!Array.isArray(input.ruleIds) || !input.ruleIds.every(isNonEmptyString)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
          "ruleIds must be an array of non-empty strings",
          "query.ruleIds"
        )
      );
    }
    query.ruleIds = Object.freeze(input.ruleIds.map((id) => String(id).trim()));
  }

  if (input.priorAlerts !== undefined) {
    if (!Array.isArray(input.priorAlerts)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
          "priorAlerts must be an array",
          "query.priorAlerts"
        )
      );
    }
    query.priorAlerts = Object.freeze([...input.priorAlerts]);
  }

  if (input.acknowledgements !== undefined) {
    if (!isPlainObject(input.acknowledgements)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
          "acknowledgements must be a plain object keyed by deduplicationKey",
          "query.acknowledgements"
        )
      );
    }
    query.acknowledgements = deepFreeze({ ...input.acknowledgements });
  }

  return ok(deepFreeze(query));
}

/**
 * @param {unknown} input
 */
export function normalizeOperationalAlertsInsightsQuery(input) {
  return createOperationalAlertsInsightsQuery(input);
}
