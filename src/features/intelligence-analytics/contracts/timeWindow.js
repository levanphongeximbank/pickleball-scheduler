/**
 * Time-window and granularity contracts.
 */

import { fail, ok } from "./result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "./errors.js";
import { ANALYTICS_GRANULARITY } from "./enums.js";
import { deepFreeze, isNonEmptyString, isPlainObject, isValidIsoTimestamp } from "./shared.js";

/**
 * @typedef {{
 *   startAt: string,
 *   endAt: string,
 *   timezone?: string,
 *   inclusive?: boolean,
 * }} AnalyticsTimeWindow
 */

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsTimeWindow(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TIME_WINDOW_INVALID,
        "AnalyticsTimeWindow must be a plain object",
        "timeWindow"
      )
    );
  }

  if (!isValidIsoTimestamp(input.startAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TIME_WINDOW_INVALID,
        "AnalyticsTimeWindow.startAt must be an ISO timestamp",
        "timeWindow.startAt"
      )
    );
  }
  if (!isValidIsoTimestamp(input.endAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TIME_WINDOW_INVALID,
        "AnalyticsTimeWindow.endAt must be an ISO timestamp",
        "timeWindow.endAt"
      )
    );
  }

  const startMs = Date.parse(String(input.startAt));
  const endMs = Date.parse(String(input.endAt));
  if (endMs < startMs) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TIME_WINDOW_INVALID,
        "AnalyticsTimeWindow.endAt must be >= startAt",
        "timeWindow.endAt"
      )
    );
  }

  /** @type {AnalyticsTimeWindow} */
  const window = {
    startAt: String(input.startAt).trim(),
    endAt: String(input.endAt).trim(),
    inclusive: input.inclusive === undefined ? true : Boolean(input.inclusive),
  };

  if (input.timezone !== undefined) {
    if (!isNonEmptyString(input.timezone)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TIME_WINDOW_INVALID,
          "AnalyticsTimeWindow.timezone must be a non-empty string when provided",
          "timeWindow.timezone"
        )
      );
    }
    window.timezone = String(input.timezone).trim();
  }

  return ok(deepFreeze(window));
}

/**
 * @param {unknown} value
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsGranularity(value) {
  if (!isNonEmptyString(value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsGranularity must be a non-empty string",
        "granularity"
      )
    );
  }
  const granularity = String(value).trim();
  const allowed = new Set(Object.values(ANALYTICS_GRANULARITY));
  if (!allowed.has(granularity)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        `Unsupported AnalyticsGranularity: ${granularity}`,
        "granularity",
        { granularity }
      )
    );
  }
  return ok(granularity);
}
