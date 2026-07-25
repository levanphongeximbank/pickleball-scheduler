/**
 * Customer / Player analytics query descriptor (I&A-08).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsTimeWindow } from "../contracts/timeWindow.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createCustomerPlayerAnalyticsContext } from "./context.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerPlayerAnalyticsQuery(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_QUERY_INVALID,
        "CustomerPlayerAnalyticsQuery must be a plain object",
        "query"
      )
    );
  }

  const contextResult = createCustomerPlayerAnalyticsContext(
    input.context || {
      tenantScope: input.tenantScope,
      customerId: input.customerId,
      playerId: input.playerId,
    }
  );
  if (!contextResult.ok) return contextResult;

  /** @type {Record<string, unknown>} */
  const query = {
    context: contextResult.value,
    includeDashboardPayloads: input.includeDashboardPayloads === true,
    includeHistoricalObservations:
      input.includeHistoricalObservations === true,
  };

  if (input.timeWindow !== undefined) {
    const timeWindowResult = createAnalyticsTimeWindow(input.timeWindow);
    if (!timeWindowResult.ok) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_QUERY_INVALID,
          timeWindowResult.error.message,
          "query.timeWindow",
          timeWindowResult.error.details
        )
      );
    }
    query.timeWindow = timeWindowResult.value;
  }

  return ok(deepFreeze(query));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function normalizeCustomerPlayerAnalyticsQuery(input) {
  return createCustomerPlayerAnalyticsQuery(input);
}
