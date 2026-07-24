/**
 * Deterministic projection execution pipeline (I&A-03).
 *
 * observations → tenant guard → time window → filters → group → aggregate → order → limit
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  createAnalyticsResult,
  createAnalyticsWarning,
} from "../contracts/analyticsResult.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { aggregateExplicit } from "../aggregation/aggregateExplicit.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import {
  applyObservationFilters,
  applyTenantGuard,
  applyTimeWindowFilter,
  groupObservations,
  orderDataPoints,
} from "./projectionPipeline.js";

/**
 * @typedef {{
 *   descriptor: import("../contracts/queryDescriptor.js").AnalyticsQueryDescriptor,
 *   definition: import("../contracts/metricDefinition.js").AnalyticsMetricDefinition,
 *   resultLimit?: number,
 *   generatedAt: string,
 *   sourceProvenance: import("../contracts/source.js").AnalyticsMetricProvenance,
 *   sourceFreshness: string,
 *   sourceTimestamp?: string,
 *   warnings?: ReadonlyArray<import("../contracts/analyticsResult.js").AnalyticsWarning>,
 * }} AnalyticsProjectionDefinition
 *
 * @typedef {{
 *   observations: ReadonlyArray<import("./observation.js").AnalyticsObservation>,
 * }} AnalyticsProjectionContext
 *
 * @typedef {{
 *   result: import("../contracts/analyticsResult.js").AnalyticsResult,
 *   projection: {
 *     observationCount: number,
 *     includedObservationCount: number,
 *     groupCount: number,
 *     truncated: boolean,
 *   },
 * }} AnalyticsProjectionResult
 */

/**
 * @param {unknown} definitionInput
 * @param {unknown} contextInput
 * @returns {import("../contracts/result.js").Result}
 */
export function executeAnalyticsProjection(definitionInput, contextInput) {
  if (!isPlainObject(definitionInput) || !isPlainObject(contextInput)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_FAILURE,
        "executeAnalyticsProjection requires definition and context objects",
        "projection"
      )
    );
  }

  const descriptor = definitionInput.descriptor;
  const definition = definitionInput.definition;
  if (!isPlainObject(descriptor) || !isPlainObject(definition)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_FAILURE,
        "Projection definition requires descriptor and metric definition",
        "projection.definition"
      )
    );
  }

  if (!Array.isArray(contextInput.observations)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_FAILURE,
        "Projection context.observations must be an array",
        "projection.context.observations"
      )
    );
  }

  /** @type {import("../contracts/analyticsResult.js").AnalyticsWarning[]} */
  const warnings = Array.isArray(definitionInput.warnings)
    ? [...definitionInput.warnings]
    : [];

  const generatedAt = String(definitionInput.generatedAt || "").trim();
  if (!generatedAt) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_FAILURE,
        "Projection definition.generatedAt is required",
        "projection.generatedAt"
      )
    );
  }

  let observations = [...contextInput.observations];

  // Metric identity guard — never mix versions.
  observations = observations.filter(
    (obs) =>
      obs.metricId === descriptor.metricId &&
      obs.metricVersion === descriptor.metricVersion
  );

  observations = applyTenantGuard(observations, descriptor.tenantScope);
  observations = applyTimeWindowFilter(observations, descriptor.timeWindow);
  observations = applyObservationFilters(observations, descriptor.filters);

  const groups = groupObservations(observations, descriptor.grouping);
  /** @type {Array<{ key: string, value: number | null, dimensions?: Record<string, string>, missing?: boolean }>} */
  const dataPoints = [];

  for (const group of groups) {
    const aggregateResult = aggregateExplicit(
      group.observations.map((o) => ({
        value: o.missing ? null : o.value,
      })),
      {
        aggregationKind: descriptor.aggregationKind,
        missingDataSemantics: definition.missingDataSemantics,
      }
    );
    if (!aggregateResult.ok) {
      if (
        aggregateResult.error.code === ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
            aggregateResult.error.message,
            aggregateResult.error.field,
            aggregateResult.error.details
          )
        );
      }
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PROJECTION_FAILURE,
          aggregateResult.error.message,
          aggregateResult.error.field,
          aggregateResult.error.details
        )
      );
    }

    /** @type {{ key: string, value: number | null, dimensions?: Record<string, string>, missing?: boolean }} */
    const point = {
      key: group.key,
      value: aggregateResult.value.value,
      missing: aggregateResult.value.value === null,
    };
    if (Object.keys(group.dimensions).length > 0) {
      point.dimensions = group.dimensions;
    }
    dataPoints.push(point);
  }

  let ordered = orderDataPoints(dataPoints, descriptor.ordering);
  let truncated = false;
  const resultLimit =
    typeof definitionInput.resultLimit === "number"
      ? definitionInput.resultLimit
      : undefined;

  if (resultLimit !== undefined && ordered.length > resultLimit) {
    ordered = ordered.slice(0, resultLimit);
    truncated = true;
    const limitWarning = createAnalyticsWarning({
      code: "ANALYTICS_RESULT_TRUNCATED",
      message: `Result truncated to resultLimit=${resultLimit}`,
      field: "resultLimit",
    });
    if (limitWarning.ok) warnings.push(limitWarning.value);
  }

  const freshness = Object.values(ANALYTICS_FRESHNESS_STATE).includes(
    /** @type {string} */ (definitionInput.sourceFreshness)
  )
    ? /** @type {string} */ (definitionInput.sourceFreshness)
    : ANALYTICS_FRESHNESS_STATE.UNKNOWN;

  if (freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
    const staleWarning = createAnalyticsWarning({
      code: "ANALYTICS_SOURCE_STALE",
      message: "Source freshness is stale",
      field: "freshness",
    });
    if (staleWarning.ok) warnings.push(staleWarning.value);
  }

  const resultBuild = createAnalyticsResult({
    metricId: descriptor.metricId,
    metricVersion: descriptor.metricVersion,
    tenantScope: descriptor.tenantScope,
    requestedWindow: descriptor.timeWindow,
    effectiveWindow: descriptor.timeWindow,
    generatedAt,
    provenance: definitionInput.sourceProvenance,
    freshness,
    warnings,
    dataPoints: ordered,
    series: [],
  });

  if (!resultBuild.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PROJECTION_FAILURE,
        resultBuild.error.message,
        resultBuild.error.field,
        resultBuild.error.details
      )
    );
  }

  /** @type {AnalyticsProjectionResult} */
  const projectionResult = {
    result: resultBuild.value,
    projection: deepFreeze({
      observationCount: contextInput.observations.length,
      includedObservationCount: observations.length,
      groupCount: groups.length,
      truncated,
      sourceTimestamp: definitionInput.sourceTimestamp,
    }),
  };

  return ok(deepFreeze(projectionResult));
}
