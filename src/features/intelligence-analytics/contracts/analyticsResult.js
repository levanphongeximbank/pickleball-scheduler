/**
 * Analytics data-point, series, warning, error, and result contracts.
 * Results carry provenance and never claim to be canonical module state.
 */

import { fail, ok } from "./result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "./errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "./enums.js";
import { createAnalyticsMetricId, createAnalyticsMetricVersion } from "./identifiers.js";
import { createAnalyticsMetricProvenance } from "./source.js";
import { createAnalyticsTenantScope } from "./tenantScope.js";
import { createAnalyticsTimeWindow } from "./timeWindow.js";
import { deepFreeze, isFiniteNumber, isNonEmptyString, isPlainObject, isValidIsoTimestamp } from "./shared.js";

/**
 * @typedef {{
 *   key: string,
 *   value: number | null,
 *   dimensions?: Readonly<Record<string, string>>,
 *   observedAt?: string,
 *   missing?: boolean,
 * }} AnalyticsDataPoint
 *
 * @typedef {{
 *   seriesId: string,
 *   label?: string,
 *   points: ReadonlyArray<AnalyticsDataPoint>,
 * }} AnalyticsSeries
 *
 * @typedef {{
 *   code: string,
 *   message: string,
 *   field?: string,
 * }} AnalyticsWarning
 *
 * @typedef {{
 *   code: string,
 *   message: string,
 *   field?: string,
 *   details?: Readonly<Record<string, unknown>>,
 * }} AnalyticsError
 *
 * @typedef {{
 *   metricId: string,
 *   metricVersion: string,
 *   tenantScope: import("./tenantScope.js").AnalyticsTenantScope,
 *   requestedWindow: import("./timeWindow.js").AnalyticsTimeWindow,
 *   effectiveWindow: import("./timeWindow.js").AnalyticsTimeWindow,
 *   generatedAt: string,
 *   provenance: import("./source.js").AnalyticsMetricProvenance,
 *   freshness: string,
 *   warnings: ReadonlyArray<AnalyticsWarning>,
 *   dataPoints: ReadonlyArray<AnalyticsDataPoint>,
 *   series: ReadonlyArray<AnalyticsSeries>,
 *   isCanonicalModuleState: false,
 * }} AnalyticsResult
 */

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsDataPoint(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_INVALID,
        "AnalyticsDataPoint must be a plain object",
        "dataPoint"
      )
    );
  }
  if (!isNonEmptyString(input.key)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_INVALID,
        "AnalyticsDataPoint.key is required",
        "dataPoint.key"
      )
    );
  }

  const missing = Boolean(input.missing);
  /** @type {number | null} */
  let value = null;
  if (input.value !== null && input.value !== undefined) {
    if (!isFiniteNumber(input.value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT,
          "AnalyticsDataPoint.value must be a finite number or null",
          "dataPoint.value",
          { value: input.value }
        )
      );
    }
    value = input.value;
  }

  /** @type {AnalyticsDataPoint} */
  const point = {
    key: String(input.key).trim(),
    value,
    missing,
  };

  if (input.dimensions !== undefined) {
    if (!isPlainObject(input.dimensions)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PROJECTION_INVALID,
          "AnalyticsDataPoint.dimensions must be a plain object",
          "dataPoint.dimensions"
        )
      );
    }
    /** @type {Record<string, string>} */
    const dimensions = {};
    for (const [k, v] of Object.entries(input.dimensions)) {
      if (!isNonEmptyString(k) || !isNonEmptyString(v)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.PROJECTION_INVALID,
            "AnalyticsDataPoint.dimensions entries must be non-empty strings",
            "dataPoint.dimensions"
          )
        );
      }
      dimensions[String(k).trim()] = String(v).trim();
    }
    point.dimensions = Object.freeze(dimensions);
  }

  if (input.observedAt !== undefined) {
    if (!isValidIsoTimestamp(input.observedAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PROJECTION_INVALID,
          "AnalyticsDataPoint.observedAt must be an ISO timestamp",
          "dataPoint.observedAt"
        )
      );
    }
    point.observedAt = String(input.observedAt).trim();
  }

  return ok(deepFreeze(point));
}

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsSeries(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_INVALID,
        "AnalyticsSeries must be a plain object",
        "series"
      )
    );
  }
  if (!isNonEmptyString(input.seriesId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_INVALID,
        "AnalyticsSeries.seriesId is required",
        "series.seriesId"
      )
    );
  }
  if (!Array.isArray(input.points)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_INVALID,
        "AnalyticsSeries.points must be an array",
        "series.points"
      )
    );
  }

  /** @type {AnalyticsDataPoint[]} */
  const points = [];
  for (const pointInput of input.points) {
    const pointResult = createAnalyticsDataPoint(pointInput);
    if (!pointResult.ok) return pointResult;
    points.push(pointResult.value);
  }

  /** @type {AnalyticsSeries} */
  const series = {
    seriesId: String(input.seriesId).trim(),
    points: Object.freeze([...points]),
  };
  if (input.label !== undefined) {
    if (!isNonEmptyString(input.label)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PROJECTION_INVALID,
          "AnalyticsSeries.label must be a non-empty string when provided",
          "series.label"
        )
      );
    }
    series.label = String(input.label).trim();
  }

  return ok(deepFreeze(series));
}

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsWarning(input) {
  if (!isPlainObject(input) || !isNonEmptyString(input.code) || !isNonEmptyString(input.message)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsWarning requires code and message",
        "warning"
      )
    );
  }
  /** @type {AnalyticsWarning} */
  const warning = {
    code: String(input.code).trim(),
    message: String(input.message).trim(),
  };
  if (input.field !== undefined) {
    warning.field = String(input.field);
  }
  return ok(deepFreeze(warning));
}

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsResult(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsResult must be a plain object",
        "result"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) return metricIdResult;
  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) return versionResult;

  const tenantScopeResult = createAnalyticsTenantScope(input.tenantScope);
  if (!tenantScopeResult.ok) return tenantScopeResult;

  const requestedWindowResult = createAnalyticsTimeWindow(input.requestedWindow);
  if (!requestedWindowResult.ok) return requestedWindowResult;

  const effectiveWindowResult = createAnalyticsTimeWindow(
    input.effectiveWindow === undefined ? input.requestedWindow : input.effectiveWindow
  );
  if (!effectiveWindowResult.ok) return effectiveWindowResult;

  if (!isValidIsoTimestamp(input.generatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsResult.generatedAt must be an ISO timestamp",
        "result.generatedAt"
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
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        `Unsupported freshness state: ${freshness}`,
        "result.freshness"
      )
    );
  }

  /** @type {AnalyticsWarning[]} */
  const warnings = [];
  if (input.warnings !== undefined) {
    if (!Array.isArray(input.warnings)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_INPUT,
          "AnalyticsResult.warnings must be an array",
          "result.warnings"
        )
      );
    }
    for (const warningInput of input.warnings) {
      const warningResult = createAnalyticsWarning(warningInput);
      if (!warningResult.ok) return warningResult;
      warnings.push(warningResult.value);
    }
  }

  /** @type {AnalyticsDataPoint[]} */
  const dataPoints = [];
  if (input.dataPoints !== undefined) {
    if (!Array.isArray(input.dataPoints)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_INPUT,
          "AnalyticsResult.dataPoints must be an array",
          "result.dataPoints"
        )
      );
    }
    for (const pointInput of input.dataPoints) {
      const pointResult = createAnalyticsDataPoint(pointInput);
      if (!pointResult.ok) return pointResult;
      dataPoints.push(pointResult.value);
    }
  }

  /** @type {AnalyticsSeries[]} */
  const series = [];
  if (input.series !== undefined) {
    if (!Array.isArray(input.series)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_INPUT,
          "AnalyticsResult.series must be an array",
          "result.series"
        )
      );
    }
    for (const seriesInput of input.series) {
      const seriesResult = createAnalyticsSeries(seriesInput);
      if (!seriesResult.ok) return seriesResult;
      series.push(seriesResult.value);
    }
  }

  /** @type {AnalyticsResult} */
  const result = {
    metricId: metricIdResult.value,
    metricVersion: versionResult.value,
    tenantScope: tenantScopeResult.value,
    requestedWindow: requestedWindowResult.value,
    effectiveWindow: effectiveWindowResult.value,
    generatedAt: String(input.generatedAt).trim(),
    provenance: provenanceResult.value,
    freshness,
    warnings: Object.freeze([...warnings]),
    dataPoints: Object.freeze([...dataPoints]),
    series: Object.freeze([...series]),
    isCanonicalModuleState: false,
  };

  return ok(deepFreeze(result));
}
