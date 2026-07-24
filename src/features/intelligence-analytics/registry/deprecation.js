/**
 * Deprecation and replacement metadata for registry entries.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  createAnalyticsMetricId,
  createAnalyticsMetricVersion,
} from "../contracts/identifiers.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";

/**
 * @typedef {{
 *   metricId: string,
 *   version: string,
 * }} AnalyticsMetricReplacementReference
 *
 * @typedef {{
 *   reason: string,
 *   deprecatedAt?: string,
 *   replacement?: AnalyticsMetricReplacementReference,
 * }} AnalyticsMetricDeprecation
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsMetricReplacementReference(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
        "Replacement reference must be a plain object",
        "deprecation.replacement"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) return metricIdResult;

  const versionResult = createAnalyticsMetricVersion(input.version);
  if (!versionResult.ok) return versionResult;

  return ok(
    deepFreeze({
      metricId: metricIdResult.value,
      version: versionResult.value,
    })
  );
}

/**
 * @param {unknown} input
 * @param {{ metricId: string, version: string }} [selfRef]
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsMetricDeprecation(input, selfRef) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
        "Deprecation metadata must be a plain object",
        "deprecation"
      )
    );
  }

  if (!isNonEmptyString(input.reason)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
        "Deprecation reason is required",
        "deprecation.reason"
      )
    );
  }

  /** @type {AnalyticsMetricDeprecation} */
  const deprecation = {
    reason: String(input.reason).trim(),
  };

  if (input.deprecatedAt !== undefined) {
    if (!isValidIsoTimestamp(input.deprecatedAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
          "Deprecation deprecatedAt must be an ISO timestamp",
          "deprecation.deprecatedAt"
        )
      );
    }
    deprecation.deprecatedAt = String(input.deprecatedAt).trim();
  }

  if (input.replacement !== undefined) {
    const replacementResult = createAnalyticsMetricReplacementReference(
      input.replacement
    );
    if (!replacementResult.ok) return replacementResult;

    if (
      selfRef &&
      replacementResult.value.metricId === selfRef.metricId &&
      replacementResult.value.version === selfRef.version
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REGISTRY_REPLACEMENT_SELF_REFERENCE,
          "Replacement reference must not point to the same metric ID and version",
          "deprecation.replacement",
          {
            metricId: selfRef.metricId,
            version: selfRef.version,
          }
        )
      );
    }

    deprecation.replacement = replacementResult.value;
  }

  return ok(deepFreeze(deprecation));
}
