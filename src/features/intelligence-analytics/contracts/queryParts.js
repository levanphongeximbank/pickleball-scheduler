/**
 * Module-neutral dimension, filter, grouping, and ordering descriptors.
 * No SQL, table names, or domain business rules.
 */

import { fail, ok } from "./result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "./errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "./shared.js";

/**
 * @typedef {{ key: string, label?: string }} AnalyticsDimension
 * @typedef {{
 *   field: string,
 *   operator: string,
 *   value?: *,
 * }} AnalyticsFilter
 * @typedef {{ dimensions: ReadonlyArray<AnalyticsDimension> }} AnalyticsGrouping
 * @typedef {{
 *   field: string,
 *   direction: "asc" | "desc",
 * }} AnalyticsOrdering
 */

const FILTER_OPERATORS = Object.freeze({
  EQ: "eq",
  NEQ: "neq",
  IN: "in",
  NOT_IN: "not_in",
  GT: "gt",
  GTE: "gte",
  LT: "lt",
  LTE: "lte",
  IS_NULL: "is_null",
  IS_NOT_NULL: "is_not_null",
});

export { FILTER_OPERATORS as ANALYTICS_FILTER_OPERATOR };

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsDimension(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsDimension must be a plain object",
        "dimension"
      )
    );
  }
  if (!isNonEmptyString(input.key)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsDimension.key is required",
        "dimension.key"
      )
    );
  }
  /** @type {AnalyticsDimension} */
  const dimension = { key: String(input.key).trim() };
  if (input.label !== undefined) {
    if (!isNonEmptyString(input.label)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_INPUT,
          "AnalyticsDimension.label must be a non-empty string when provided",
          "dimension.label"
        )
      );
    }
    dimension.label = String(input.label).trim();
  }
  return ok(deepFreeze(dimension));
}

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsFilter(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsFilter must be a plain object",
        "filter"
      )
    );
  }
  if (!isNonEmptyString(input.field)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsFilter.field is required",
        "filter.field"
      )
    );
  }
  if (!isNonEmptyString(input.operator)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsFilter.operator is required",
        "filter.operator"
      )
    );
  }
  const operator = String(input.operator).trim();
  const allowed = new Set(Object.values(FILTER_OPERATORS));
  if (!allowed.has(operator)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        `Unsupported AnalyticsFilter.operator: ${operator}`,
        "filter.operator",
        { operator }
      )
    );
  }

  /** @type {AnalyticsFilter} */
  const filter = {
    field: String(input.field).trim(),
    operator,
  };

  if (operator !== FILTER_OPERATORS.IS_NULL && operator !== FILTER_OPERATORS.IS_NOT_NULL) {
    if (!("value" in input)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_INPUT,
          "AnalyticsFilter.value is required for this operator",
          "filter.value"
        )
      );
    }
    filter.value = input.value;
  }

  return ok(deepFreeze(filter));
}

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsGrouping(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsGrouping must be a plain object",
        "grouping"
      )
    );
  }
  if (!Array.isArray(input.dimensions)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsGrouping.dimensions must be an array",
        "grouping.dimensions"
      )
    );
  }

  /** @type {AnalyticsDimension[]} */
  const dimensions = [];
  for (let i = 0; i < input.dimensions.length; i += 1) {
    const dimResult = createAnalyticsDimension(input.dimensions[i]);
    if (!dimResult.ok) {
      return dimResult;
    }
    dimensions.push(dimResult.value);
  }

  return ok(deepFreeze({ dimensions }));
}

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsOrdering(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsOrdering must be a plain object",
        "ordering"
      )
    );
  }
  if (!isNonEmptyString(input.field)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsOrdering.field is required",
        "ordering.field"
      )
    );
  }
  const direction = input.direction === undefined ? "asc" : String(input.direction).trim();
  if (direction !== "asc" && direction !== "desc") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "AnalyticsOrdering.direction must be 'asc' or 'desc'",
        "ordering.direction"
      )
    );
  }
  return ok(
    deepFreeze({
      field: String(input.field).trim(),
      direction: /** @type {"asc"|"desc"} */ (direction),
    })
  );
}
