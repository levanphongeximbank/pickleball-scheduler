/**
 * Module-neutral analytics observation contracts for I&A-03.
 * Not Competition / Finance / Player schema.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsMetricId, createAnalyticsMetricVersion } from "../contracts/identifiers.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import { createAnalyticsTenantScope } from "../contracts/tenantScope.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";

/**
 * @typedef {number | null} AnalyticsObservationValue
 *
 * @typedef {{
 *   metricId: string,
 *   metricVersion: string,
 *   tenantScope: import("../contracts/tenantScope.js").AnalyticsTenantScope,
 *   observedAt: string,
 *   dimensions: Readonly<Record<string, string>>,
 *   value: AnalyticsObservationValue,
 *   missing: boolean,
 *   provenance: import("../contracts/source.js").AnalyticsMetricProvenance,
 *   freshness: string,
 *   sourceRecordRef?: string,
 * }} AnalyticsObservation
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsObservation(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
        "AnalyticsObservation must be a plain object",
        "observation"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
        metricIdResult.error.message,
        "observation.metricId",
        metricIdResult.error.details
      )
    );
  }

  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
        versionResult.error.message,
        "observation.metricVersion",
        versionResult.error.details
      )
    );
  }

  const tenantScopeResult = createAnalyticsTenantScope(input.tenantScope);
  if (!tenantScopeResult.ok) return tenantScopeResult;

  if (!isValidIsoTimestamp(input.observedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
        "AnalyticsObservation.observedAt must be an ISO timestamp",
        "observation.observedAt"
      )
    );
  }

  const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
  if (!provenanceResult.ok) return provenanceResult;

  const freshness = isNonEmptyString(input.freshness)
    ? String(input.freshness).trim()
    : ANALYTICS_FRESHNESS_STATE.UNKNOWN;
  if (!Object.values(ANALYTICS_FRESHNESS_STATE).includes(freshness)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
        `Unsupported observation freshness: ${freshness}`,
        "observation.freshness"
      )
    );
  }

  const missing = Boolean(input.missing);
  /** @type {AnalyticsObservationValue} */
  let value = null;
  if (input.value !== null && input.value !== undefined) {
    if (!isFiniteNumber(input.value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
          "AnalyticsObservation.value must be a finite number or null",
          "observation.value",
          { value: input.value }
        )
      );
    }
    value = input.value;
  }

  /** @type {Record<string, string>} */
  const dimensions = {};
  if (input.dimensions !== undefined) {
    if (!isPlainObject(input.dimensions)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
          "AnalyticsObservation.dimensions must be a plain object",
          "observation.dimensions"
        )
      );
    }
    for (const [k, v] of Object.entries(input.dimensions)) {
      if (!isNonEmptyString(k) || typeof v !== "string") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
            "AnalyticsObservation.dimensions entries must be string keys with string values",
            "observation.dimensions"
          )
        );
      }
      dimensions[String(k).trim()] = String(v);
    }
  }

  /** @type {AnalyticsObservation} */
  const observation = {
    metricId: metricIdResult.value,
    metricVersion: versionResult.value,
    tenantScope: tenantScopeResult.value,
    observedAt: String(input.observedAt).trim(),
    dimensions: Object.freeze(dimensions),
    value,
    missing: missing || value === null,
    provenance: provenanceResult.value,
    freshness,
  };

  if (input.sourceRecordRef !== undefined) {
    if (!isNonEmptyString(input.sourceRecordRef)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
          "AnalyticsObservation.sourceRecordRef must be a non-empty string when provided",
          "observation.sourceRecordRef"
        )
      );
    }
    observation.sourceRecordRef = String(input.sourceRecordRef).trim();
  }

  return ok(deepFreeze(observation));
}
