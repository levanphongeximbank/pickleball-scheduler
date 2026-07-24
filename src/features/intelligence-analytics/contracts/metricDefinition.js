/**
 * AnalyticsMetricDefinition — stable identity, version, provenance, and semantics.
 */

import { fail, ok } from "./result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "./errors.js";
import {
  ANALYTICS_AGGREGATION_KIND,
  ANALYTICS_METRIC_KIND,
  ANALYTICS_METRIC_UNIT,
  ANALYTICS_MISSING_DATA_SEMANTICS,
} from "./enums.js";
import { createAnalyticsMetricId, createAnalyticsMetricVersion } from "./identifiers.js";
import { createAnalyticsMetricSource } from "./source.js";
import { ANALYTICS_TENANT_SCOPE_KIND } from "./tenantScope.js";
import { createAnalyticsDimension } from "./queryParts.js";
import { ANALYTICS_GRANULARITY } from "./enums.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "./shared.js";

/**
 * @typedef {{
 *   metricId: string,
 *   version: string,
 *   definition: string,
 *   unit: string,
 *   aggregationKind: string,
 *   metricKind: string,
 *   source: import("./source.js").AnalyticsMetricSource,
 *   supportedTenantScopeKinds: ReadonlyArray<string>,
 *   supportedGranularities: ReadonlyArray<string>,
 *   allowedDimensions: ReadonlyArray<import("./queryParts.js").AnalyticsDimension>,
 *   missingDataSemantics: string,
 * }} AnalyticsMetricDefinition
 */

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsMetricDefinition(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        "AnalyticsMetricDefinition must be a plain object",
        "definition"
      )
    );
  }

  const metricIdResult = createAnalyticsMetricId(input.metricId);
  if (!metricIdResult.ok) return metricIdResult;

  const versionResult = createAnalyticsMetricVersion(input.version);
  if (!versionResult.ok) return versionResult;

  if (!isNonEmptyString(input.definition)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        "Human-readable definition is required",
        "definition.definition"
      )
    );
  }

  const unit = isNonEmptyString(input.unit) ? String(input.unit).trim() : "";
  if (!Object.values(ANALYTICS_METRIC_UNIT).includes(unit)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        `Unsupported metric unit: ${unit}`,
        "definition.unit",
        { unit }
      )
    );
  }

  const aggregationKind = isNonEmptyString(input.aggregationKind)
    ? String(input.aggregationKind).trim()
    : "";
  if (!Object.values(ANALYTICS_AGGREGATION_KIND).includes(aggregationKind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        `Unsupported aggregation kind: ${aggregationKind}`,
        "definition.aggregationKind",
        { aggregationKind }
      )
    );
  }

  const metricKind = isNonEmptyString(input.metricKind)
    ? String(input.metricKind).trim()
    : "";
  if (!Object.values(ANALYTICS_METRIC_KIND).includes(metricKind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        `Unsupported metric kind: ${metricKind}`,
        "definition.metricKind",
        { metricKind }
      )
    );
  }

  const sourceResult = createAnalyticsMetricSource(input.source);
  if (!sourceResult.ok) return sourceResult;

  const missingDataSemantics = isNonEmptyString(input.missingDataSemantics)
    ? String(input.missingDataSemantics).trim()
    : ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL;
  if (!Object.values(ANALYTICS_MISSING_DATA_SEMANTICS).includes(missingDataSemantics)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        `Unsupported missing-data semantics: ${missingDataSemantics}`,
        "definition.missingDataSemantics"
      )
    );
  }

  const scopeKindsInput = Array.isArray(input.supportedTenantScopeKinds)
    ? input.supportedTenantScopeKinds
    : [ANALYTICS_TENANT_SCOPE_KIND.TENANT];
  /** @type {string[]} */
  const supportedTenantScopeKinds = [];
  const allowedScopeKinds = new Set(Object.values(ANALYTICS_TENANT_SCOPE_KIND));
  for (const kind of scopeKindsInput) {
    if (!isNonEmptyString(kind) || !allowedScopeKinds.has(String(kind).trim())) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
          `Unsupported tenant scope kind in definition: ${kind}`,
          "definition.supportedTenantScopeKinds"
        )
      );
    }
    supportedTenantScopeKinds.push(String(kind).trim());
  }

  const granularitiesInput = Array.isArray(input.supportedGranularities)
    ? input.supportedGranularities
    : [ANALYTICS_GRANULARITY.WINDOW];
  /** @type {string[]} */
  const supportedGranularities = [];
  const allowedGranularities = new Set(Object.values(ANALYTICS_GRANULARITY));
  for (const g of granularitiesInput) {
    if (!isNonEmptyString(g) || !allowedGranularities.has(String(g).trim())) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
          `Unsupported granularity in definition: ${g}`,
          "definition.supportedGranularities"
        )
      );
    }
    supportedGranularities.push(String(g).trim());
  }

  const dimsInput = Array.isArray(input.allowedDimensions) ? input.allowedDimensions : [];
  /** @type {import("./queryParts.js").AnalyticsDimension[]} */
  const allowedDimensions = [];
  for (const dim of dimsInput) {
    const dimResult = createAnalyticsDimension(dim);
    if (!dimResult.ok) return dimResult;
    allowedDimensions.push(dimResult.value);
  }

  /** @type {AnalyticsMetricDefinition} */
  const definition = {
    metricId: metricIdResult.value,
    version: versionResult.value,
    definition: String(input.definition).trim(),
    unit,
    aggregationKind,
    metricKind,
    source: sourceResult.value,
    supportedTenantScopeKinds: Object.freeze([...supportedTenantScopeKinds]),
    supportedGranularities: Object.freeze([...supportedGranularities]),
    allowedDimensions: Object.freeze([...allowedDimensions]),
    missingDataSemantics,
  };

  return ok(deepFreeze(definition));
}
