/**
 * Metric and query binding contracts (I&A-04).
 * Binds to exact I&A-01 metric identity and query descriptors.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  createAnalyticsMetricId,
  createAnalyticsMetricVersion,
} from "../contracts/identifiers.js";
import {
  cloneAnalyticsQueryDescriptor,
  createAnalyticsQueryDescriptor,
} from "../contracts/queryDescriptor.js";
import { ANALYTICS_AGGREGATION_KIND } from "../contracts/enums.js";
import {
  ANALYTICS_METRIC_LIFECYCLE_STATE,
} from "../registry/lifecycle.js";
import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import { assertNoForbiddenContractContent } from "./forbidden.js";

/**
 * @typedef {{
 *   metricId: string,
 *   metricVersion: string,
 *   aggregationOverride?: string,
 *   presentationAlias?: string,
 *   comparisonMetricId?: string,
 *   comparisonMetricVersion?: string,
 * }} AnalyticsMetricBinding
 *
 * @typedef {{
 *   bindingId: string,
 *   query: import("../contracts/queryDescriptor.js").AnalyticsQueryDescriptor,
 *   presentationAlias?: string,
 * }} AnalyticsQueryBinding
 */

/**
 * Optional registry-backed validation for deprecated/retired metrics.
 * @param {string} metricId
 * @param {string} metricVersion
 * @param {unknown} [registry]
 * @returns {import("../contracts/result.js").Result}
 */
function validateAgainstRegistry(metricId, metricVersion, registry) {
  if (registry === undefined || registry === null) {
    return ok(true);
  }
  if (
    !isPlainObject(registry) ||
    typeof registry.getMetric !== "function"
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.BINDING_INVALID,
        "metric registry must expose getMetric when provided",
        "registry"
      )
    );
  }

  const lookedUp = registry.getMetric(metricId, metricVersion);
  if (!lookedUp || typeof lookedUp !== "object") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.BINDING_INVALID,
        "metric registry getMetric returned an invalid result",
        "registry"
      )
    );
  }
  if (!lookedUp.ok) {
    return lookedUp;
  }

  const entry = lookedUp.value;
  const lifecycle =
    entry && typeof entry === "object" ? entry.lifecycleState : undefined;
  if (lifecycle === ANALYTICS_METRIC_LIFECYCLE_STATE.RETIRED) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.METRIC_RETIRED,
        "Metric binding references a retired metric",
        "metricBinding",
        { metricId, metricVersion }
      )
    );
  }

  return ok(
    deepFreeze({
      lifecycleState: lifecycle,
      deprecated: lifecycle === ANALYTICS_METRIC_LIFECYCLE_STATE.DEPRECATED,
      entry: clonePlain(entry),
    })
  );
}

/**
 * @param {unknown} input
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsMetricBinding(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.BINDING_INVALID,
        "AnalyticsMetricBinding must be a plain object",
        "metricBinding"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "metricBinding");
  if (!forbidden.ok) return forbidden;

  const idResult = createAnalyticsMetricId(input.metricId);
  if (!idResult.ok) return idResult;
  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) return versionResult;

  /** @type {AnalyticsMetricBinding} */
  const binding = {
    metricId: idResult.value,
    metricVersion: versionResult.value,
  };

  if (input.aggregationOverride !== undefined) {
    if (
      !isNonEmptyString(input.aggregationOverride) ||
      !Object.values(ANALYTICS_AGGREGATION_KIND).includes(
        String(input.aggregationOverride).trim()
      )
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.BINDING_INVALID,
          "aggregationOverride must be a supported aggregation kind",
          "metricBinding.aggregationOverride"
        )
      );
    }
    binding.aggregationOverride = String(input.aggregationOverride).trim();
  }

  if (input.presentationAlias !== undefined) {
    if (!isNonEmptyString(input.presentationAlias)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.BINDING_INVALID,
          "presentationAlias must be a non-empty string when provided",
          "metricBinding.presentationAlias"
        )
      );
    }
    binding.presentationAlias = String(input.presentationAlias).trim();
  }

  const hasComparisonId = input.comparisonMetricId !== undefined;
  const hasComparisonVersion = input.comparisonMetricVersion !== undefined;
  if (hasComparisonId !== hasComparisonVersion) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.BINDING_INVALID,
        "comparisonMetricId and comparisonMetricVersion must both be provided",
        "metricBinding.comparisonMetricId"
      )
    );
  }
  if (hasComparisonId) {
    const cmpId = createAnalyticsMetricId(input.comparisonMetricId);
    if (!cmpId.ok) return cmpId;
    const cmpVersion = createAnalyticsMetricVersion(input.comparisonMetricVersion);
    if (!cmpVersion.ok) return cmpVersion;
    binding.comparisonMetricId = cmpId.value;
    binding.comparisonMetricVersion = cmpVersion.value;
  }

  const registryCheck = validateAgainstRegistry(
    binding.metricId,
    binding.metricVersion,
    options.registry
  );
  if (!registryCheck.ok) return registryCheck;

  if (binding.comparisonMetricId && binding.comparisonMetricVersion) {
    const cmpCheck = validateAgainstRegistry(
      binding.comparisonMetricId,
      binding.comparisonMetricVersion,
      options.registry
    );
    if (!cmpCheck.ok) return cmpCheck;
  }

  return ok(deepFreeze(binding));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsQueryBinding(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.BINDING_INVALID,
        "AnalyticsQueryBinding must be a plain object",
        "queryBinding"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "queryBinding");
  if (!forbidden.ok) return forbidden;

  if (!isNonEmptyString(input.bindingId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.BINDING_INVALID,
        "AnalyticsQueryBinding.bindingId is required",
        "queryBinding.bindingId"
      )
    );
  }

  // Accept either a raw query input or an already-created frozen descriptor.
  /** @type {import("../contracts/queryDescriptor.js").AnalyticsQueryDescriptor} */
  let query;
  if (
    isPlainObject(input.query) &&
    typeof input.query.metricId === "string" &&
    typeof input.query.metricVersion === "string" &&
    isPlainObject(input.query.tenantScope) &&
    isPlainObject(input.query.timeWindow) &&
    Object.isFrozen(input.query)
  ) {
    query = cloneAnalyticsQueryDescriptor(input.query);
  } else {
    const queryResult = createAnalyticsQueryDescriptor(input.query);
    if (!queryResult.ok) return queryResult;
    query = queryResult.value;
  }

  /** @type {AnalyticsQueryBinding} */
  const binding = {
    bindingId: String(input.bindingId).trim(),
    query,
  };

  if (input.presentationAlias !== undefined) {
    if (!isNonEmptyString(input.presentationAlias)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.BINDING_INVALID,
          "presentationAlias must be a non-empty string when provided",
          "queryBinding.presentationAlias"
        )
      );
    }
    binding.presentationAlias = String(input.presentationAlias).trim();
  }

  return ok(deepFreeze(binding));
}
