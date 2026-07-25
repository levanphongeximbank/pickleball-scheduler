/**
 * Read-only Historical Analytics facade / runtime (I&A-05).
 * Composes registry + read-only source + normalize/bucket/compare/trend.
 * No global singleton. No write/persist surface.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import {
  clonePlain,
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";
import { validateAnalyticsQueryExecution } from "../runtime/validateExecution.js";
import {
  resolveMetricFromRegistry,
  validateQueryAgainstMetricDefinition,
} from "../runtime/resolveMetric.js";
import {
  createAnalyticsSourceRequest,
  wrapSourceFailure,
} from "../runtime/sourceAdapter.js";
import { normalizeHistoricalQuery } from "./query.js";
import { bucketHistoricalObservations } from "./bucketing.js";
import {
  compareHistoricalPeriods,
  previousEquivalentWindow,
  sumSeriesObservedValues,
} from "./comparison.js";
import { analyzeTrend } from "./trend.js";
import { applyCumulative, applyMovingWindow } from "./movingCumulative.js";
import { ANALYTICS_COMPARISON_KIND, ANALYTICS_COMPLETENESS_STATE } from "./enums.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyHistoricalAnalyticsFacade does not expose write/command operations";

/**
 * @param {unknown} deps
 * @returns {import("../contracts/result.js").Result}
 */
export function createHistoricalAnalyticsRuntime(deps) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "createHistoricalAnalyticsRuntime requires a dependencies object",
        "deps"
      )
    );
  }

  const registry = deps.registry;
  const sourceAdapter = deps.sourceAdapter;

  if (!isPlainObject(registry) || typeof registry.getMetric !== "function") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "createHistoricalAnalyticsRuntime requires registry.getMetric",
        "deps.registry"
      )
    );
  }
  if (!isPlainObject(sourceAdapter) || typeof sourceAdapter.query !== "function") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
        "createHistoricalAnalyticsRuntime requires sourceAdapter.query",
        "deps.sourceAdapter"
      )
    );
  }

  const nowIso =
    typeof deps.nowIso === "function"
      ? deps.nowIso
      : () => new Date().toISOString();

  let executionCounter = 0;

  /**
   * @param {unknown} queryInput
   * @param {unknown} [accessInput]
   * @param {unknown} [options]
   */
  function analyze(queryInput, accessInput = {}, options = {}) {
    const optionsObj = isPlainObject(options) ? options : {};
    const inputSnapshot = isPlainObject(queryInput)
      ? JSON.stringify(queryInput)
      : null;

    const normalized = normalizeHistoricalQuery(queryInput);
    if (!normalized.ok) return normalized;

    if (inputSnapshot !== null && JSON.stringify(queryInput) !== inputSnapshot) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_QUERY_INVALID,
          "Historical query input must not be mutated",
          "query"
        )
      );
    }

    const descriptor = normalized.value;

    // Reuse IA-03 tenant/access validation against a compatible shape.
    const accessCheck = validateAnalyticsQueryExecution(
      {
        tenantScope: descriptor.tenantScope,
        metricId: descriptor.metricId,
        metricVersion: descriptor.metricVersion,
        timeWindow: descriptor.timeWindow,
        aggregationKind: descriptor.aggregationKind,
        granularity: descriptor.granularity,
        filters: descriptor.filters,
        ...(descriptor.grouping ? { grouping: descriptor.grouping } : {}),
      },
      accessInput
    );
    if (!accessCheck.ok) return accessCheck;

    const resolved = resolveMetricFromRegistry(
      registry,
      descriptor.metricId,
      descriptor.metricVersion
    );
    if (!resolved.ok) return resolved;

    const againstDef = validateQueryAgainstMetricDefinition(
      {
        metricId: descriptor.metricId,
        metricVersion: descriptor.metricVersion,
        tenantScope: descriptor.tenantScope,
        timeWindow: descriptor.timeWindow,
        aggregationKind: descriptor.aggregationKind,
        granularity: descriptor.granularity,
        filters: descriptor.filters,
        ...(descriptor.grouping ? { grouping: descriptor.grouping } : {}),
      },
      resolved.value.entry
    );
    if (!againstDef.ok) return againstDef;

    executionCounter += 1;
    const executionId =
      typeof optionsObj.executionId === "string" && optionsObj.executionId.trim()
        ? String(optionsObj.executionId).trim()
        : `ia05-${executionCounter}-${descriptor.metricId}`;

    const sourceRequestResult = createAnalyticsSourceRequest({
      metricId: descriptor.metricId,
      metricVersion: descriptor.metricVersion,
      tenantScope: descriptor.tenantScope,
      timeWindow: descriptor.timeWindow,
      executionId,
    });
    if (!sourceRequestResult.ok) return sourceRequestResult;

    let sourceResponse;
    try {
      sourceResponse = sourceAdapter.query(sourceRequestResult.value);
    } catch (error) {
      return wrapSourceFailure(error);
    }

    if (
      sourceResponse &&
      typeof sourceResponse === "object" &&
      typeof sourceResponse.then === "function"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_SOURCE_FAILURE,
          "Async historical source adapters are deferred",
          "sourceAdapter"
        )
      );
    }

    if (!sourceResponse || sourceResponse.ok !== true) {
      if (sourceResponse && sourceResponse.ok === false) {
        const code = sourceResponse.error?.code;
        if (
          code === ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE ||
          code === ANALYTICS_ERROR_CODE.SOURCE_FAILURE ||
          code === ANALYTICS_ERROR_CODE.INVALID_OBSERVATION ||
          code === ANALYTICS_ERROR_CODE.HISTORICAL_SOURCE_FAILURE
        ) {
          return sourceResponse;
        }
        return wrapSourceFailure(sourceResponse.error);
      }
      return wrapSourceFailure(sourceResponse);
    }

    // Source unavailable with empty + unavailable freshness must not be empty success.
    if (
      sourceResponse.value.freshness === ANALYTICS_FRESHNESS_STATE.UNKNOWN &&
      Array.isArray(sourceResponse.value.observations) &&
      sourceResponse.value.observations.length === 0 &&
      optionsObj.requireObservations === true
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
          "Historical source returned no observations while marked unavailable",
          "sourceAdapter"
        )
      );
    }

    const bucketed = bucketHistoricalObservations(
      sourceResponse.value.observations,
      descriptor,
      {
        missingDataSemantics:
          resolved.value.entry.definition.missingDataSemantics,
      }
    );
    if (!bucketed.ok) return bucketed;

    const series = bucketed.value.series;
    /** @type {unknown[]} */
    const warnings = [...(resolved.value.warnings || []), ...(series.warnings || [])];

    const trendResult = analyzeTrend({ series });
    if (!trendResult.ok) return trendResult;

    /** @type {object | undefined} */
    let comparison;
    if (descriptor.comparison || descriptor.baseline) {
      let baselineWindow;
      /** @type {string} */
      let kind;

      if (descriptor.baseline) {
        baselineWindow = descriptor.baseline.timeWindow;
        kind = ANALYTICS_COMPARISON_KIND.EXPLICIT_BASELINE;
      } else if (
        descriptor.comparison?.kind === ANALYTICS_COMPARISON_KIND.EXPLICIT_BASELINE &&
        descriptor.comparison.timeWindow
      ) {
        baselineWindow = descriptor.comparison.timeWindow;
        kind = ANALYTICS_COMPARISON_KIND.EXPLICIT_BASELINE;
      } else if (descriptor.comparison?.timeWindow) {
        baselineWindow = descriptor.comparison.timeWindow;
        kind = descriptor.comparison.kind;
      } else {
        const prev = previousEquivalentWindow(descriptor.timeWindow);
        if (!prev.ok) return prev;
        baselineWindow = prev.value;
        kind = ANALYTICS_COMPARISON_KIND.PREVIOUS_EQUIVALENT_PERIOD;
      }

      // Fetch baseline observations via same adapter (read-only).
      const baselineRequest = createAnalyticsSourceRequest({
        metricId: descriptor.metricId,
        metricVersion: descriptor.metricVersion,
        tenantScope: descriptor.tenantScope,
        timeWindow: baselineWindow,
        executionId: `${executionId}-baseline`,
      });
      if (!baselineRequest.ok) return baselineRequest;

      let baselineResponse;
      try {
        baselineResponse = sourceAdapter.query(baselineRequest.value);
      } catch (error) {
        return wrapSourceFailure(error);
      }
      if (!baselineResponse || baselineResponse.ok !== true) {
        return baselineResponse && baselineResponse.ok === false
          ? baselineResponse
          : wrapSourceFailure(baselineResponse);
      }

      const baselineBucketed = bucketHistoricalObservations(
        baselineResponse.value.observations,
        {
          ...descriptor,
          timeWindow: baselineWindow,
          comparison: undefined,
          baseline: undefined,
          movingWindow: undefined,
          includeCumulative: false,
        },
        {
          missingDataSemantics:
            resolved.value.entry.definition.missingDataSemantics,
        }
      );
      if (!baselineBucketed.ok) return baselineBucketed;

      const currentValue = sumSeriesObservedValues(series);
      const baselineValue = sumSeriesObservedValues(baselineBucketed.value.series);

      const compared = compareHistoricalPeriods({
        kind,
        metricId: descriptor.metricId,
        metricVersion: descriptor.metricVersion,
        currentWindow: descriptor.timeWindow,
        baselineWindow,
        currentValue,
        baselineValue,
        ...(descriptor.baseline?.label
          ? { baselineLabel: descriptor.baseline.label }
          : {}),
      });
      if (!compared.ok) return compared;
      comparison = compared.value;
    }

    /** @type {object | undefined} */
    let movingWindowResult;
    if (descriptor.movingWindow) {
      const moved = applyMovingWindow(series, descriptor.movingWindow);
      if (!moved.ok) return moved;
      movingWindowResult = moved.value;
    }

    /** @type {object | undefined} */
    let cumulativeResult;
    if (descriptor.includeCumulative) {
      const cum = applyCumulative(series, {
        kind: "sum",
        aggregationKind: descriptor.aggregationKind,
      });
      if (!cum.ok) return cum;
      cumulativeResult = cum.value;
    }

    const generatedAt = nowIso();
    const stale =
      sourceResponse.value.freshness === ANALYTICS_FRESHNESS_STATE.STALE;

    if (
      series.coverage.completeness === ANALYTICS_COMPLETENESS_STATE.PARTIAL
    ) {
      const warning = createAnalyticsWarning({
        code: "ANALYTICS_HISTORICAL_PARTIAL_COVERAGE",
        message: "Historical series coverage is partial",
        field: "coverage.completeness",
        details: {
          coverageRatio: series.coverage.coverageRatio,
          missingBucketCount: series.coverage.missingBucketCount,
        },
      });
      if (warning.ok) warnings.push(warning.value);
    }

    /** @type {Record<string, unknown>} */
    const result = {
      metricId: descriptor.metricId,
      metricVersion: descriptor.metricVersion,
      tenantScope: clonePlain(descriptor.tenantScope),
      requestedWindow: clonePlain(descriptor.timeWindow),
      effectiveWindow: clonePlain(bucketed.value.effectiveWindow),
      granularity: descriptor.granularity,
      aggregationKind: descriptor.aggregationKind,
      missingPeriodPolicy: descriptor.missingPeriodPolicy,
      series,
      trend: trendResult.value,
      coverage: series.coverage,
      missingPeriods: series.missingPeriods,
      provenance: clonePlain(sourceResponse.value.provenance),
      freshness: sourceResponse.value.freshness,
      sourceTimestamp: sourceResponse.value.sourceTimestamp,
      generatedAt,
      stale,
      completeness: series.coverage.completeness,
      warnings: Object.freeze([...warnings]),
      calculation: deepFreeze({
        method: trendResult.value.method,
        deterministic: true,
        executionId,
      }),
      resolvedMetric: deepFreeze({
        metricId: resolved.value.entry.metricId,
        version: resolved.value.entry.version,
        lifecycleState: resolved.value.entry.lifecycleState,
        deprecation: resolved.value.deprecation,
      }),
      ...(comparison ? { comparison } : {}),
      ...(movingWindowResult ? { movingWindow: movingWindowResult } : {}),
      ...(cumulativeResult ? { cumulative: cumulativeResult } : {}),
    };

    return ok(deepFreeze(result));
  }

  /**
   * Validate-only — never calls the source adapter.
   */
  function validate(queryInput, accessInput = {}) {
    const normalized = normalizeHistoricalQuery(queryInput);
    if (!normalized.ok) return normalized;

    const accessCheck = validateAnalyticsQueryExecution(
      {
        tenantScope: normalized.value.tenantScope,
        metricId: normalized.value.metricId,
        metricVersion: normalized.value.metricVersion,
        timeWindow: normalized.value.timeWindow,
        aggregationKind: normalized.value.aggregationKind,
        granularity: normalized.value.granularity,
        filters: normalized.value.filters,
      },
      accessInput
    );
    if (!accessCheck.ok) return accessCheck;

    const resolved = resolveMetricFromRegistry(
      registry,
      normalized.value.metricId,
      normalized.value.metricVersion
    );
    if (!resolved.ok) return resolved;

    const againstDef = validateQueryAgainstMetricDefinition(
      {
        metricId: normalized.value.metricId,
        metricVersion: normalized.value.metricVersion,
        tenantScope: normalized.value.tenantScope,
        timeWindow: normalized.value.timeWindow,
        aggregationKind: normalized.value.aggregationKind,
        granularity: normalized.value.granularity,
        filters: normalized.value.filters,
      },
      resolved.value.entry
    );
    if (!againstDef.ok) return againstDef;

    return ok(
      deepFreeze({
        descriptor: normalized.value,
        resolvedMetric: {
          metricId: resolved.value.entry.metricId,
          version: resolved.value.entry.version,
          lifecycleState: resolved.value.entry.lifecycleState,
        },
        warnings: resolved.value.warnings,
      })
    );
  }

  /** @type {Record<string, unknown>} */
  const facade = {
    analyze,
    validate,
    normalizeQuery: normalizeHistoricalQuery,
    bucketObservations: bucketHistoricalObservations,
    comparePeriods: compareHistoricalPeriods,
    analyzeTrend,
    applyMovingWindow,
    applyCumulative,
  };

  const rejectedWriteOps = [
    "write",
    "command",
    "mutate",
    "insert",
    "update",
    "upsert",
    "delete",
    "save",
    "persist",
    "register",
  ];
  for (let i = 0; i < rejectedWriteOps.length; i += 1) {
    const rejectedOp = rejectedWriteOps[i];
    Object.defineProperty(facade, rejectedOp, {
      enumerable: false,
      configurable: false,
      get() {
        return () =>
          fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED,
              WRITE_REJECT_MESSAGE,
              rejectedOp
            )
          );
      },
    });
  }

  return ok(Object.freeze(facade));
}

/**
 * Alias emphasizing the read-only facade contract.
 * @param {unknown} deps
 */
export function createReadOnlyHistoricalAnalyticsFacade(deps) {
  return createHistoricalAnalyticsRuntime(deps);
}
