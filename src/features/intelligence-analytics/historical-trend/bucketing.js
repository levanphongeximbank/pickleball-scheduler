/**
 * Normalize observations → deterministic buckets → missing-period handling.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  ANALYTICS_AGGREGATION_KIND,
  ANALYTICS_MISSING_DATA_SEMANTICS,
} from "../contracts/enums.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import {
  clonePlain,
  deepFreeze,
  isFiniteNumber,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  ANALYTICS_COMPLETENESS_STATE,
  ANALYTICS_MISSING_PERIOD_POLICY,
  ANALYTICS_POINT_ORIGIN,
} from "./enums.js";
import {
  aggregateBucketValues,
  bucketStartUtc,
  enumerateBucketBoundaries,
  isTimestampInWindow,
  nextBucketStartUtc,
} from "./timeBuckets.js";
import {
  createAnalyticsCoverage,
  createAnalyticsHistoricalObservation,
  createAnalyticsHistoricalSeries,
} from "./series.js";

/**
 * @param {unknown} observationsInput
 * @param {import("./query.js").AnalyticsHistoricalQuery} query
 * @param {{
 *   missingDataSemantics?: string,
 *   groupKey?: string,
 * }} [options]
 */
export function bucketHistoricalObservations(observationsInput, query, options = {}) {
  if (!isPlainObject(query)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "bucketHistoricalObservations requires a historical query",
        "query"
      )
    );
  }

  // Prove non-mutation of caller observation array contents reference shape.
  const inputSnapshot = Array.isArray(observationsInput)
    ? JSON.stringify(observationsInput)
    : null;

  if (!Array.isArray(observationsInput)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        "observations must be an array",
        "observations"
      )
    );
  }

  /** @type {import("./series.js").createAnalyticsHistoricalObservation extends Function ? any[] : never} */
  const validated = [];
  /** @type {unknown[]} */
  const warnings = [];

  for (let i = 0; i < observationsInput.length; i += 1) {
    const raw = observationsInput[i];
    if (!isPlainObject(raw)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
          "Each observation must be a plain object",
          `observations[${i}]`
        )
      );
    }

    if (!isValidIsoTimestamp(raw.observedAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
          "Invalid observation timestamp",
          `observations[${i}].observedAt`
        )
      );
    }

    // Out-of-window observations are excluded (not an error).
    if (!isTimestampInWindow(String(raw.observedAt), query.timeWindow)) {
      continue;
    }

    // Tenant isolation — never mix tenants.
    const obsTenant = raw.tenantScope?.tenantId;
    const queryTenant = query.tenantScope?.tenantId;
    if (queryTenant && obsTenant && obsTenant !== queryTenant) {
      continue;
    }

    // Exact metric identity — never mix versions.
    if (
      raw.metricId !== query.metricId ||
      raw.metricVersion !== query.metricVersion
    ) {
      continue;
    }

    if (raw.value !== null && raw.value !== undefined && !isFiniteNumber(raw.value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT,
          "Invalid numeric observation value",
          `observations[${i}].value`,
          { value: raw.value }
        )
      );
    }

    const created = createAnalyticsHistoricalObservation(raw);
    if (!created.ok) return created;
    validated.push(created.value);
  }

  const boundariesResult = enumerateBucketBoundaries(
    query.timeWindow,
    query.granularity,
    query.maxBucketCount
  );
  if (!boundariesResult.ok) return boundariesResult;
  const boundaries = boundariesResult.value;

  /** @type {Map<string, { bucket: any, values: Array<number|null>, observedAts: string[] }>} */
  const byKey = new Map();
  for (const bucket of boundaries) {
    byKey.set(bucket.key, { bucket, values: [], observedAts: [] });
  }

  for (const obs of validated) {
    const start = bucketStartUtc(new Date(obs.observedAt), query.granularity);
    if (!start) continue;
    const next = nextBucketStartUtc(start, query.granularity);
    if (!next) continue;
    const key = start.toISOString();
    const slot = byKey.get(key);
    if (!slot) continue; // outside enumerated expected buckets
    slot.values.push(obs.missing ? null : obs.value);
    slot.observedAts.push(obs.observedAt);
  }

  const policy = query.missingPeriodPolicy;
  const missingDataSemantics =
    options.missingDataSemantics || ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL;

  /** @type {any[]} */
  const points = [];
  /** @type {any[]} */
  const missingPeriods = [];
  let observedBucketCount = 0;
  let missingBucketCount = 0;
  let filledBucketCount = 0;
  /** @type {string | undefined} */
  let firstObservedAt;
  /** @type {string | undefined} */
  let lastObservedAt;

  for (const bucket of boundaries) {
    const slot = byKey.get(bucket.key);
    const hasObserved = Boolean(slot && slot.observedAts.length > 0);
    const aggregated = hasObserved
      ? aggregateBucketValues(slot.values, query.aggregationKind)
      : null;

    if (hasObserved) {
      observedBucketCount += 1;
      for (const at of slot.observedAts) {
        if (!firstObservedAt || at < firstObservedAt) firstObservedAt = at;
        if (!lastObservedAt || at > lastObservedAt) lastObservedAt = at;
      }
      points.push({
        bucket,
        value: aggregated,
        missing: aggregated === null,
        origin: ANALYTICS_POINT_ORIGIN.OBSERVED,
        synthetic: false,
        observationCount: slot.observedAts.length,
      });
      continue;
    }

    missingBucketCount += 1;
    missingPeriods.push(
      deepFreeze({
        key: bucket.key,
        startAt: bucket.startAt,
        endAt: bucket.endAt,
      })
    );

    if (policy === ANALYTICS_MISSING_PERIOD_POLICY.OMIT) {
      continue;
    }

    if (policy === ANALYTICS_MISSING_PERIOD_POLICY.PRESERVE_MISSING) {
      points.push({
        bucket,
        value: null,
        missing: true,
        origin: ANALYTICS_POINT_ORIGIN.MISSING,
        synthetic: false,
        observationCount: 0,
      });
      continue;
    }

    if (policy === ANALYTICS_MISSING_PERIOD_POLICY.FILL_NULL) {
      filledBucketCount += 1;
      points.push({
        bucket,
        value: null,
        missing: true,
        origin: ANALYTICS_POINT_ORIGIN.SYNTHETIC_FILLED,
        synthetic: true,
        observationCount: 0,
      });
      continue;
    }

    if (policy === ANALYTICS_MISSING_PERIOD_POLICY.FILL_ZERO_WHEN_ALLOWED) {
      if (missingDataSemantics !== ANALYTICS_MISSING_DATA_SEMANTICS.COALESCE_ZERO) {
        const warning = createAnalyticsWarning({
          code: "ANALYTICS_HISTORICAL_FILL_ZERO_DENIED",
          message:
            "FILL_ZERO_WHEN_ALLOWED ignored because metric missing-data semantics do not allow coalesce_zero; preserving missing",
          field: "missingPeriodPolicy",
        });
        if (warning.ok) warnings.push(warning.value);
        points.push({
          bucket,
          value: null,
          missing: true,
          origin: ANALYTICS_POINT_ORIGIN.MISSING,
          synthetic: false,
          observationCount: 0,
        });
        continue;
      }
      filledBucketCount += 1;
      points.push({
        bucket,
        value: 0,
        missing: false,
        origin: ANALYTICS_POINT_ORIGIN.SYNTHETIC_FILLED,
        synthetic: true,
        observationCount: 0,
      });
      continue;
    }

    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_MISSING_POLICY_INVALID,
        `Unhandled missing-period policy: ${policy}`,
        "missingPeriodPolicy"
      )
    );
  }

  const expectedBucketCount = boundaries.length;
  const completeness =
    expectedBucketCount === 0
      ? ANALYTICS_COMPLETENESS_STATE.EMPTY
      : missingBucketCount === 0 && observedBucketCount === expectedBucketCount
        ? ANALYTICS_COMPLETENESS_STATE.COMPLETE
        : observedBucketCount === 0
          ? ANALYTICS_COMPLETENESS_STATE.EMPTY
          : ANALYTICS_COMPLETENESS_STATE.PARTIAL;

  const coverageResult = createAnalyticsCoverage({
    expectedBucketCount,
    observedBucketCount,
    missingBucketCount,
    filledBucketCount,
    completeness,
    ...(firstObservedAt ? { firstObservedAt } : {}),
    ...(lastObservedAt ? { lastObservedAt } : {}),
  });
  if (!coverageResult.ok) return coverageResult;

  const seriesResult = createAnalyticsHistoricalSeries({
    seriesId: `${query.metricId}@${query.metricVersion}:historical`,
    metricId: query.metricId,
    metricVersion: query.metricVersion,
    tenantScope: query.tenantScope,
    points,
    coverage: coverageResult.value,
    missingPeriods,
    warnings,
    ...(options.groupKey !== undefined ? { groupKey: options.groupKey } : {}),
  });
  if (!seriesResult.ok) return seriesResult;

  if (inputSnapshot !== null && JSON.stringify(observationsInput) !== inputSnapshot) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
        "Observation input must not be mutated during bucketing",
        "observations"
      )
    );
  }

  return ok(
    deepFreeze({
      series: seriesResult.value,
      effectiveWindow: clonePlain(query.timeWindow),
      requestedWindow: clonePlain(query.timeWindow),
      granularity: query.granularity,
      aggregationKind: query.aggregationKind,
      // Keep a frozen copy of aggregation kinds for callers/tests.
      supportedAggregationKinds: Object.freeze([
        ...Object.values(ANALYTICS_AGGREGATION_KIND),
      ]),
    })
  );
}
