/**
 * Deterministic query normalization for I&A-03.
 * Does not mutate caller input. Does not invent tenant or metric version.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  cloneAnalyticsQueryDescriptor,
  createAnalyticsQueryDescriptor,
} from "../contracts/queryDescriptor.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";

/**
 * @typedef {{
 *   descriptor: import("../contracts/queryDescriptor.js").AnalyticsQueryDescriptor,
 *   resultLimit?: number,
 * }} NormalizedAnalyticsQuery
 */

const MAX_RESULT_LIMIT = 10_000;

/**
 * Normalize and freeze an analytics query without mutating the input object.
 * Optional `resultLimit` is validated when present on the input envelope.
 *
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function normalizeAnalyticsQuery(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_QUERY,
        "Analytics query input must be a plain object",
        "query"
      )
    );
  }

  // Prefer explicit `descriptor` envelope; otherwise treat input as descriptor fields.
  const descriptorInput =
    input.descriptor !== undefined ? input.descriptor : input;

  const descriptorResult = createAnalyticsQueryDescriptor(descriptorInput);
  if (!descriptorResult.ok) {
    // Preserve typed tenant / time-window / aggregation codes from I&A-01.
    const preserveCodes = new Set([
      ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
      ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
      ANALYTICS_ERROR_CODE.TIME_WINDOW_INVALID,
      ANALYTICS_ERROR_CODE.UNSUPPORTED_AGGREGATION,
      ANALYTICS_ERROR_CODE.METRIC_ID_REQUIRED,
      ANALYTICS_ERROR_CODE.METRIC_VERSION_REQUIRED,
      ANALYTICS_ERROR_CODE.RESULT_LIMIT_EXCEEDED,
    ]);
    if (preserveCodes.has(descriptorResult.error.code)) {
      return descriptorResult;
    }
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_QUERY,
        descriptorResult.error.message,
        descriptorResult.error.field || "query",
        descriptorResult.error.details
      )
    );
  }

  /** @type {NormalizedAnalyticsQuery} */
  const normalized = {
    descriptor: cloneAnalyticsQueryDescriptor(descriptorResult.value),
  };

  if (input.resultLimit !== undefined) {
    if (
      typeof input.resultLimit !== "number" ||
      !Number.isInteger(input.resultLimit) ||
      input.resultLimit < 1
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_QUERY,
          "resultLimit must be a positive integer",
          "query.resultLimit",
          { resultLimit: input.resultLimit }
        )
      );
    }
    if (input.resultLimit > MAX_RESULT_LIMIT) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.RESULT_LIMIT_EXCEEDED,
          `resultLimit exceeds maximum allowed bound of ${MAX_RESULT_LIMIT}`,
          "query.resultLimit",
          { resultLimit: input.resultLimit, max: MAX_RESULT_LIMIT }
        )
      );
    }
    normalized.resultLimit = input.resultLimit;
  }

  // Stable filter ordering by field then operator then JSON value (deterministic).
  const filters = [...normalized.descriptor.filters].sort((a, b) => {
    if (a.field !== b.field) return a.field < b.field ? -1 : 1;
    if (a.operator !== b.operator) return a.operator < b.operator ? -1 : 1;
    const av = JSON.stringify(a.value ?? null);
    const bv = JSON.stringify(b.value ?? null);
    if (av === bv) return 0;
    return av < bv ? -1 : 1;
  });

  const ordering = normalized.descriptor.ordering
    ? [...normalized.descriptor.ordering]
    : undefined;

  /** @type {import("../contracts/queryDescriptor.js").AnalyticsQueryDescriptor} */
  const stableDescriptor = {
    metricId: normalized.descriptor.metricId,
    metricVersion: normalized.descriptor.metricVersion,
    tenantScope: normalized.descriptor.tenantScope,
    timeWindow: normalized.descriptor.timeWindow,
    aggregationKind: normalized.descriptor.aggregationKind,
    granularity: normalized.descriptor.granularity,
    filters: Object.freeze(filters),
  };
  if (normalized.descriptor.grouping) {
    stableDescriptor.grouping = normalized.descriptor.grouping;
  }
  if (ordering) {
    stableDescriptor.ordering = Object.freeze(ordering);
  }

  normalized.descriptor = deepFreeze(clonePlain(stableDescriptor));

  return ok(deepFreeze(normalized));
}

export { MAX_RESULT_LIMIT };
