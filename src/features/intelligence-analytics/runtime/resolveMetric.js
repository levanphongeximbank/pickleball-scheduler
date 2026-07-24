/**
 * Registry-backed metric resolution for the query runtime.
 * Uses I&A-02 read-only registry lookup — does not copy registry logic.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import { ANALYTICS_METRIC_LIFECYCLE_STATE } from "../registry/lifecycle.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

/**
 * @typedef {{
 *   entry: import("../registry/entry.js").AnalyticsMetricRegistryEntry,
 *   warnings: ReadonlyArray<import("../contracts/analyticsResult.js").AnalyticsWarning>,
 * }} ResolvedMetric
 */

/**
 * @param {{ getMetric: Function }} registry
 * @param {string} metricId
 * @param {string} metricVersion
 * @returns {import("../contracts/result.js").Result}
 */
export function resolveMetricFromRegistry(registry, metricId, metricVersion) {
  if (!isPlainObject(registry) || typeof registry.getMetric !== "function") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_QUERY,
        "Query runtime requires a read-only metric registry with getMetric",
        "registry"
      )
    );
  }

  const lookup = registry.getMetric(metricId, metricVersion);
  if (!lookup.ok) {
    const code =
      lookup.error?.code === ANALYTICS_ERROR_CODE.METRIC_VERSION_REQUIRED ||
      lookup.error?.code === ANALYTICS_ERROR_CODE.METRIC_ID_REQUIRED
        ? lookup.error.code
        : ANALYTICS_ERROR_CODE.METRIC_NOT_FOUND;

    // Distinguish missing version vs missing metric id when registry reports not found.
    if (lookup.error?.code === ANALYTICS_ERROR_CODE.REGISTRY_NOT_FOUND) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.METRIC_VERSION_NOT_FOUND,
          "Exact metric ID/version was not found in the registry",
          "metric",
          { metricId, metricVersion }
        )
      );
    }

    return fail(
      analyticsError(code, lookup.error.message, lookup.error.field, {
        metricId,
        metricVersion,
        ...(lookup.error.details || {}),
      })
    );
  }

  const entry = lookup.value;
  /** @type {import("../contracts/analyticsResult.js").AnalyticsWarning[]} */
  const warnings = [];

  if (entry.lifecycleState === ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.METRIC_RETIRED,
        "Retired metrics cannot be executed by the query runtime",
        "metric.lifecycleState",
        {
          metricId,
          metricVersion,
          lifecycleState: entry.lifecycleState,
        }
      )
    );
  }

  if (entry.lifecycleState === ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED) {
    /** @type {Record<string, unknown>} */
    const details = {
      metricId,
      metricVersion,
      lifecycleState: entry.lifecycleState,
    };
    if (entry.deprecation) {
      details.deprecation = entry.deprecation;
      if (entry.deprecation.replacement) {
        details.replacement = entry.deprecation.replacement;
      }
    }
    const warningResult = createAnalyticsWarning({
      code: "ANALYTICS_METRIC_DEPRECATED",
      message: "Resolved metric is deprecated; prefer replacement when available",
      field: "metric.lifecycleState",
    });
    if (warningResult.ok) {
      warnings.push(
        deepFreeze({
          ...warningResult.value,
          // keep replacement metadata discoverable via details on execution result
        })
      );
    }
    // Attach structured replacement via a second warning field if present.
    if (entry.deprecation?.replacement) {
      const replacementWarning = createAnalyticsWarning({
        code: "ANALYTICS_METRIC_REPLACEMENT",
        message: `Replacement metric ${entry.deprecation.replacement.metricId}@${entry.deprecation.replacement.version}`,
        field: "metric.deprecation.replacement",
      });
      if (replacementWarning.ok) warnings.push(replacementWarning.value);
    }
  }

  if (entry.lifecycleState === ANALYTICS_METRIC_LIFECYCLE_STATE.DRAFT) {
    const draftWarning = createAnalyticsWarning({
      code: "ANALYTICS_METRIC_DRAFT",
      message: "Resolved metric is in draft lifecycle state",
      field: "metric.lifecycleState",
    });
    if (draftWarning.ok) warnings.push(draftWarning.value);
  }

  return ok(
    deepFreeze({
      entry,
      warnings,
      deprecation: entry.deprecation,
    })
  );
}

/**
 * Validate query dimensions / aggregation / tenant scope / granularity against definition.
 *
 * @param {import("../contracts/queryDescriptor.js").AnalyticsQueryDescriptor} descriptor
 * @param {import("../registry/entry.js").AnalyticsMetricRegistryEntry} entry
 * @returns {import("../contracts/result.js").Result}
 */
export function validateQueryAgainstMetricDefinition(descriptor, entry) {
  const definition = entry.definition;

  if (!definition.supportedTenantScopeKinds.includes(descriptor.tenantScope.kind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_SCOPE_MISMATCH,
        "Query tenant scope kind is not supported by the metric definition",
        "tenantScope.kind",
        {
          kind: descriptor.tenantScope.kind,
          supported: [...definition.supportedTenantScopeKinds],
        }
      )
    );
  }

  if (!definition.supportedGranularities.includes(descriptor.granularity)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_QUERY,
        "Query granularity is not supported by the metric definition",
        "granularity",
        {
          granularity: descriptor.granularity,
          supported: [...definition.supportedGranularities],
        }
      )
    );
  }

  if (descriptor.aggregationKind !== definition.aggregationKind) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.UNSUPPORTED_AGGREGATION,
        "Query aggregationKind must match the registered metric definition",
        "aggregationKind",
        {
          query: descriptor.aggregationKind,
          definition: definition.aggregationKind,
        }
      )
    );
  }

  const allowedKeys = new Set(definition.allowedDimensions.map((d) => d.key));

  for (const filter of descriptor.filters) {
    if (!allowedKeys.has(filter.field) && filter.field !== "value") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.UNSUPPORTED_DIMENSION,
          `Filter field is not an allowed dimension: ${filter.field}`,
          "filters",
          { field: filter.field }
        )
      );
    }
  }

  if (descriptor.grouping) {
    for (const dim of descriptor.grouping.dimensions) {
      if (!allowedKeys.has(dim.key)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.UNSUPPORTED_DIMENSION,
            `Grouping dimension is not allowed: ${dim.key}`,
            "grouping",
            { key: dim.key }
          )
        );
      }
    }
  }

  if (descriptor.ordering) {
    for (const order of descriptor.ordering) {
      if (
        order.field !== "value" &&
        order.field !== "key" &&
        !allowedKeys.has(order.field)
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.UNSUPPORTED_DIMENSION,
            `Ordering field is not supported: ${order.field}`,
            "ordering",
            { field: order.field }
          )
        );
      }
    }
  }

  return ok(true);
}
