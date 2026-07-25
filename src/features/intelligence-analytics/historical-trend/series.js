/**
 * Historical observation / series / coverage contracts (I&A-05).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsMetricId, createAnalyticsMetricVersion } from "../contracts/identifiers.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import { createAnalyticsTenantScope } from "../contracts/tenantScope.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  ANALYTICS_COMPLETENESS_STATE,
  ANALYTICS_POINT_ORIGIN,
  isHistoricalEnumValue,
} from "./enums.js";
import { createAnalyticsTimeBucket } from "./timeBuckets.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsHistoricalObservation(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        "AnalyticsHistoricalObservation must be a plain object",
        "observation"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        metricIdResult.error.message,
        "observation.metricId"
      )
    );
  }
  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        versionResult.error.message,
        "observation.metricVersion"
      )
    );
  }
  const tenantScopeResult = createAnalyticsTenantScope(input.tenantScope);
  if (!tenantScopeResult.ok) return tenantScopeResult;

  if (!isValidIsoTimestamp(input.observedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        "observedAt must be a valid ISO timestamp",
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
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        `Unsupported freshness: ${freshness}`,
        "observation.freshness"
      )
    );
  }

  let value = null;
  if (input.value !== null && input.value !== undefined) {
    if (!isFiniteNumber(input.value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT,
          "Historical observation value must be a finite number or null",
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
          ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
          "dimensions must be a plain object",
          "observation.dimensions"
        )
      );
    }
    for (const [k, v] of Object.entries(input.dimensions)) {
      if (!isNonEmptyString(k) || typeof v !== "string") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
            "dimension entries must be string→string",
            "observation.dimensions"
          )
        );
      }
      dimensions[String(k).trim()] = String(v);
    }
  }

  return ok(
    deepFreeze({
      metricId: metricIdResult.value,
      metricVersion: versionResult.value,
      tenantScope: tenantScopeResult.value,
      observedAt: String(input.observedAt).trim(),
      dimensions: Object.freeze(dimensions),
      value,
      missing: Boolean(input.missing) || value === null,
      provenance: provenanceResult.value,
      freshness,
      ...(isNonEmptyString(input.sourceRecordRef)
        ? { sourceRecordRef: String(input.sourceRecordRef).trim() }
        : {}),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsHistoricalSeriesPoint(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        "Series point must be a plain object",
        "seriesPoint"
      )
    );
  }

  const bucketResult = createAnalyticsTimeBucket(input.bucket || input);
  if (!bucketResult.ok) return bucketResult;

  const origin = isNonEmptyString(input.origin)
    ? String(input.origin).trim()
    : ANALYTICS_POINT_ORIGIN.OBSERVED;
  if (!isHistoricalEnumValue(origin, ANALYTICS_POINT_ORIGIN)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        `Unsupported point origin: ${origin}`,
        "seriesPoint.origin"
      )
    );
  }

  let value = null;
  if (input.value !== null && input.value !== undefined) {
    if (!isFiniteNumber(input.value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT,
          "Series point value must be finite or null",
          "seriesPoint.value"
        )
      );
    }
    value = input.value;
  }

  const missing = Boolean(input.missing) || value === null;
  if (
    origin === ANALYTICS_POINT_ORIGIN.OBSERVED &&
    input.synthetic === true
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        "Observed points must not be marked synthetic",
        "seriesPoint.origin"
      )
    );
  }

  return ok(
    deepFreeze({
      bucket: bucketResult.value,
      value,
      missing,
      origin,
      synthetic:
        origin === ANALYTICS_POINT_ORIGIN.SYNTHETIC_FILLED ||
        Boolean(input.synthetic),
      observationCount: isFiniteNumber(input.observationCount)
        ? input.observationCount
        : 0,
      ...(input.dimensions !== undefined && isPlainObject(input.dimensions)
        ? { dimensions: Object.freeze({ ...input.dimensions }) }
        : {}),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsCoverage(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "AnalyticsCoverage must be a plain object",
        "coverage"
      )
    );
  }

  const expectedBucketCount = Number(input.expectedBucketCount);
  const observedBucketCount = Number(input.observedBucketCount);
  const missingBucketCount = Number(input.missingBucketCount);
  const filledBucketCount = Number(input.filledBucketCount ?? 0);

  for (const [name, value] of [
    ["expectedBucketCount", expectedBucketCount],
    ["observedBucketCount", observedBucketCount],
    ["missingBucketCount", missingBucketCount],
    ["filledBucketCount", filledBucketCount],
  ]) {
    if (!isFiniteNumber(value) || value < 0) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
          `${name} must be a non-negative finite number`,
          `coverage.${name}`
        )
      );
    }
  }

  const coverageRatio =
    expectedBucketCount === 0
      ? 0
      : observedBucketCount / expectedBucketCount;

  const completeness = isNonEmptyString(input.completeness)
    ? String(input.completeness).trim()
    : coverageRatio >= 1 && missingBucketCount === 0
      ? ANALYTICS_COMPLETENESS_STATE.COMPLETE
      : expectedBucketCount === 0 || observedBucketCount === 0
        ? ANALYTICS_COMPLETENESS_STATE.EMPTY
        : ANALYTICS_COMPLETENESS_STATE.PARTIAL;

  if (!isHistoricalEnumValue(completeness, ANALYTICS_COMPLETENESS_STATE)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        `Unsupported completeness: ${completeness}`,
        "coverage.completeness"
      )
    );
  }

  // Never claim complete when missing or partial.
  if (
    completeness === ANALYTICS_COMPLETENESS_STATE.COMPLETE &&
    (missingBucketCount > 0 || coverageRatio < 1)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "Partial series must not be marked complete",
        "coverage.completeness"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const coverage = {
    expectedBucketCount,
    observedBucketCount,
    missingBucketCount,
    filledBucketCount,
    coverageRatio,
    completeness,
  };

  if (input.firstObservedAt !== undefined) {
    if (!isValidIsoTimestamp(input.firstObservedAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
          "firstObservedAt must be ISO timestamp",
          "coverage.firstObservedAt"
        )
      );
    }
    coverage.firstObservedAt = String(input.firstObservedAt).trim();
  }
  if (input.lastObservedAt !== undefined) {
    if (!isValidIsoTimestamp(input.lastObservedAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
          "lastObservedAt must be ISO timestamp",
          "coverage.lastObservedAt"
        )
      );
    }
    coverage.lastObservedAt = String(input.lastObservedAt).trim();
  }

  return ok(deepFreeze(coverage));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsHistoricalSeries(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        "AnalyticsHistoricalSeries must be a plain object",
        "series"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) return metricIdResult;
  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) return versionResult;
  const tenantScopeResult = createAnalyticsTenantScope(input.tenantScope);
  if (!tenantScopeResult.ok) return tenantScopeResult;

  if (!Array.isArray(input.points)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        "series.points must be an array",
        "series.points"
      )
    );
  }

  /** @type {unknown[]} */
  const points = [];
  for (let i = 0; i < input.points.length; i += 1) {
    const pointResult = createAnalyticsHistoricalSeriesPoint(input.points[i]);
    if (!pointResult.ok) {
      return fail(
        analyticsError(
          pointResult.error.code,
          pointResult.error.message,
          `series.points[${i}]`,
          pointResult.error.details
        )
      );
    }
    points.push(pointResult.value);
  }

  // Stable ascending order by bucket start.
  points.sort((a, b) =>
    String(/** @type {{bucket:{startAt:string}}} */ (a).bucket.startAt).localeCompare(
      String(/** @type {{bucket:{startAt:string}}} */ (b).bucket.startAt)
    )
  );

  const coverageResult = createAnalyticsCoverage(input.coverage || {
    expectedBucketCount: points.length,
    observedBucketCount: points.filter(
      (p) => /** @type {{origin:string}} */ (p).origin === ANALYTICS_POINT_ORIGIN.OBSERVED
    ).length,
    missingBucketCount: points.filter(
      (p) => /** @type {{origin:string}} */ (p).origin === ANALYTICS_POINT_ORIGIN.MISSING
    ).length,
    filledBucketCount: points.filter(
      (p) =>
        /** @type {{origin:string}} */ (p).origin ===
        ANALYTICS_POINT_ORIGIN.SYNTHETIC_FILLED
    ).length,
  });
  if (!coverageResult.ok) return coverageResult;

  /** @type {unknown[]} */
  const warnings = [];
  if (input.warnings !== undefined) {
    if (!Array.isArray(input.warnings)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
          "warnings must be an array",
          "series.warnings"
        )
      );
    }
    for (const warning of input.warnings) {
      const created = createAnalyticsWarning(warning);
      if (!created.ok) return created;
      warnings.push(created.value);
    }
  }

  const missingPeriods = Array.isArray(input.missingPeriods)
    ? Object.freeze(
        input.missingPeriods.map((p) =>
          isPlainObject(p) ? deepFreeze({ ...p }) : String(p)
        )
      )
    : Object.freeze([]);

  return ok(
    deepFreeze({
      seriesId: isNonEmptyString(input.seriesId)
        ? String(input.seriesId).trim()
        : `${metricIdResult.value}@${versionResult.value}`,
      metricId: metricIdResult.value,
      metricVersion: versionResult.value,
      tenantScope: tenantScopeResult.value,
      points: Object.freeze(points),
      coverage: coverageResult.value,
      missingPeriods,
      warnings: Object.freeze(warnings),
      ...(input.groupKey !== undefined
        ? { groupKey: String(input.groupKey) }
        : {}),
    })
  );
}
