/**
 * Read-only analytics source adapter contracts (I&A-03).
 * Adapters expose query/read only — never create/update/delete.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsMetricId, createAnalyticsMetricVersion } from "../contracts/identifiers.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import { createAnalyticsTenantScope } from "../contracts/tenantScope.js";
import { createAnalyticsTimeWindow } from "../contracts/timeWindow.js";
import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import { createAnalyticsObservation } from "./observation.js";

/**
 * @typedef {{
 *   metricId: string,
 *   metricVersion: string,
 *   tenantScope: import("../contracts/tenantScope.js").AnalyticsTenantScope,
 *   timeWindow: import("../contracts/timeWindow.js").AnalyticsTimeWindow,
 *   dimensions?: ReadonlyArray<string>,
 *   executionId?: string,
 * }} AnalyticsSourceRequest
 *
 * @typedef {{
 *   observations: ReadonlyArray<import("./observation.js").AnalyticsObservation>,
 *   provenance: import("../contracts/source.js").AnalyticsMetricProvenance,
 *   freshness: string,
 *   sourceTimestamp?: string,
 * }} AnalyticsSourceResponse
 *
 * @typedef {{
 *   query: (request: AnalyticsSourceRequest) =>
 *     import("../contracts/result.js").Result | Promise<import("../contracts/result.js").Result>,
 * }} AnalyticsSourceAdapter
 */

/**
 * Build a frozen source request with only the fields the runtime needs.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsSourceRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_QUERY,
        "AnalyticsSourceRequest must be a plain object",
        "sourceRequest"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) return metricIdResult;
  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) return versionResult;
  const tenantScopeResult = createAnalyticsTenantScope(input.tenantScope);
  if (!tenantScopeResult.ok) return tenantScopeResult;
  const timeWindowResult = createAnalyticsTimeWindow(input.timeWindow);
  if (!timeWindowResult.ok) return timeWindowResult;

  /** @type {AnalyticsSourceRequest} */
  const request = {
    metricId: metricIdResult.value,
    metricVersion: versionResult.value,
    tenantScope: tenantScopeResult.value,
    timeWindow: timeWindowResult.value,
  };

  if (input.dimensions !== undefined) {
    if (!Array.isArray(input.dimensions)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_QUERY,
          "AnalyticsSourceRequest.dimensions must be an array of strings",
          "sourceRequest.dimensions"
        )
      );
    }
    /** @type {string[]} */
    const dims = [];
    for (const d of input.dimensions) {
      if (!isNonEmptyString(d)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INVALID_QUERY,
            "AnalyticsSourceRequest.dimensions entries must be non-empty strings",
            "sourceRequest.dimensions"
          )
        );
      }
      dims.push(String(d).trim());
    }
    request.dimensions = Object.freeze([...dims]);
  }

  if (input.executionId !== undefined) {
    if (!isNonEmptyString(input.executionId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_QUERY,
          "AnalyticsSourceRequest.executionId must be a non-empty string when provided",
          "sourceRequest.executionId"
        )
      );
    }
    request.executionId = String(input.executionId).trim();
  }

  return ok(deepFreeze(request));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsSourceResponse(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
        "AnalyticsSourceResponse must be a plain object",
        "sourceResponse"
      )
    );
  }

  if (!Array.isArray(input.observations)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
        "AnalyticsSourceResponse.observations must be an array",
        "sourceResponse.observations"
      )
    );
  }

  /** @type {import("./observation.js").AnalyticsObservation[]} */
  const observations = [];
  for (let i = 0; i < input.observations.length; i += 1) {
    const obsResult = createAnalyticsObservation(input.observations[i]);
    if (!obsResult.ok) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
          obsResult.error.message,
          `sourceResponse.observations[${i}]`,
          obsResult.error.details
        )
      );
    }
    observations.push(obsResult.value);
  }

  const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
  if (!provenanceResult.ok) return provenanceResult;

  const freshness = isNonEmptyString(input.freshness)
    ? String(input.freshness).trim()
    : ANALYTICS_FRESHNESS_STATE.UNKNOWN;
  if (!Object.values(ANALYTICS_FRESHNESS_STATE).includes(freshness)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
        `Unsupported source freshness: ${freshness}`,
        "sourceResponse.freshness"
      )
    );
  }

  /** @type {AnalyticsSourceResponse} */
  const response = {
    observations: Object.freeze([...observations]),
    provenance: provenanceResult.value,
    freshness,
  };

  if (input.sourceTimestamp !== undefined) {
    if (
      typeof input.sourceTimestamp !== "string" ||
      !isNonEmptyString(input.sourceTimestamp)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
          "AnalyticsSourceResponse.sourceTimestamp must be a non-empty string when provided",
          "sourceResponse.sourceTimestamp"
        )
      );
    }
    response.sourceTimestamp = String(input.sourceTimestamp).trim();
  }

  return ok(deepFreeze(response));
}

/**
 * Wrap adapter failures into typed runtime errors (never leak raw internals).
 * @param {unknown} error
 * @returns {import("../contracts/result.js").Result}
 */
export function wrapSourceFailure(error) {
  if (
    isPlainObject(error) &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    const code = String(error.code);
    if (
      code === ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE ||
      code === ANALYTICS_ERROR_CODE.SOURCE_FAILURE ||
      code === ANALYTICS_ERROR_CODE.INVALID_OBSERVATION
    ) {
      return fail(analyticsError(code, error.message, error.field, error.details));
    }
  }

  const message =
    error instanceof Error
      ? "Analytics source adapter failed"
      : "Analytics source adapter returned an unexpected failure";

  return fail(
    analyticsError(ANALYTICS_ERROR_CODE.SOURCE_FAILURE, message, "sourceAdapter", {
      wrapped: true,
    })
  );
}

/**
 * Clone a source request for certification (no mutation of caller input).
 * @param {AnalyticsSourceRequest} request
 */
export function cloneAnalyticsSourceRequest(request) {
  return deepFreeze(clonePlain(request));
}
