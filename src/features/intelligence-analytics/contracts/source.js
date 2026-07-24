/**
 * Analytics metric source and provenance contracts.
 * Source references are module-neutral opaque identifiers — never SQL/table names.
 */

import { fail, ok } from "./result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "./errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject, isValidIsoTimestamp } from "./shared.js";

/**
 * @typedef {{
 *   sourceId: string,
 *   sourceKind: string,
 *   ownerModule: string,
 *   reference?: string,
 * }} AnalyticsMetricSource
 *
 * @typedef {{
 *   source: AnalyticsMetricSource,
 *   observedAt?: string,
 *   ingestedAt?: string,
 *   transformer?: string,
 *   notes?: string,
 * }} AnalyticsMetricProvenance
 */

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsMetricSource(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_REQUIRED,
        "AnalyticsMetricSource must be a plain object",
        "source"
      )
    );
  }

  if (!isNonEmptyString(input.sourceId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_REQUIRED,
        "AnalyticsMetricSource.sourceId is required",
        "source.sourceId"
      )
    );
  }
  if (!isNonEmptyString(input.sourceKind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_REQUIRED,
        "AnalyticsMetricSource.sourceKind is required",
        "source.sourceKind"
      )
    );
  }
  if (!isNonEmptyString(input.ownerModule)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_REQUIRED,
        "AnalyticsMetricSource.ownerModule is required",
        "source.ownerModule"
      )
    );
  }

  /** @type {AnalyticsMetricSource} */
  const source = {
    sourceId: String(input.sourceId).trim(),
    sourceKind: String(input.sourceKind).trim(),
    ownerModule: String(input.ownerModule).trim(),
  };

  if (input.reference !== undefined) {
    if (!isNonEmptyString(input.reference)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SOURCE_REQUIRED,
          "AnalyticsMetricSource.reference must be a non-empty string when provided",
          "source.reference"
        )
      );
    }
    source.reference = String(input.reference).trim();
  }

  return ok(deepFreeze(source));
}

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsMetricProvenance(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_REQUIRED,
        "AnalyticsMetricProvenance must be a plain object",
        "provenance"
      )
    );
  }

  const sourceResult = createAnalyticsMetricSource(input.source);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  /** @type {AnalyticsMetricProvenance} */
  const provenance = { source: sourceResult.value };

  if (input.observedAt !== undefined) {
    if (!isValidIsoTimestamp(input.observedAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_INPUT,
          "AnalyticsMetricProvenance.observedAt must be an ISO timestamp",
          "provenance.observedAt"
        )
      );
    }
    provenance.observedAt = String(input.observedAt).trim();
  }

  if (input.ingestedAt !== undefined) {
    if (!isValidIsoTimestamp(input.ingestedAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_INPUT,
          "AnalyticsMetricProvenance.ingestedAt must be an ISO timestamp",
          "provenance.ingestedAt"
        )
      );
    }
    provenance.ingestedAt = String(input.ingestedAt).trim();
  }

  if (input.transformer !== undefined) {
    if (!isNonEmptyString(input.transformer)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_INPUT,
          "AnalyticsMetricProvenance.transformer must be a non-empty string",
          "provenance.transformer"
        )
      );
    }
    provenance.transformer = String(input.transformer).trim();
  }

  if (input.notes !== undefined) {
    if (typeof input.notes !== "string") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_INPUT,
          "AnalyticsMetricProvenance.notes must be a string",
          "provenance.notes"
        )
      );
    }
    provenance.notes = input.notes;
  }

  return ok(deepFreeze(provenance));
}
