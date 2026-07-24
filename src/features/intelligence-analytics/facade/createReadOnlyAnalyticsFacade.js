/**
 * Read-only analytics facade interface.
 * Query/read operations only. No write commands. No Supabase/React/Platform Core.
 * No runtime singleton. Not wired to dashboard.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  cloneAnalyticsQueryDescriptor,
  createAnalyticsQueryDescriptor,
} from "../contracts/queryDescriptor.js";
import { createAnalyticsResult } from "../contracts/analyticsResult.js";
import { createAnalyticsMetricDefinition } from "../contracts/metricDefinition.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { aggregateExplicit } from "../aggregation/aggregateExplicit.js";
import { deepFreeze, isNonEmptyString, isPlainObject, isValidIsoTimestamp } from "../contracts/shared.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyAnalyticsFacade does not expose write/command operations";

/**
 * @param {object} [deps]
 * @param {() => string} [deps.nowIso]
 * @returns {Readonly<{
 *   validateQuery: Function,
 *   describeMetric: Function,
 *   aggregate: Function,
 *   query: Function,
 * }>}
 */
export function createReadOnlyAnalyticsFacade(deps = {}) {
  const nowIso =
    typeof deps.nowIso === "function"
      ? deps.nowIso
      : () => new Date().toISOString();

  /**
   * Validate and freeze a query descriptor (fail closed on tenant gaps).
   * @param {unknown} input
   */
  function validateQuery(input) {
    const result = createAnalyticsQueryDescriptor(input);
    if (!result.ok) return result;
    return ok(cloneAnalyticsQueryDescriptor(result.value));
  }

  /**
   * Validate a metric definition contract.
   * @param {unknown} input
   */
  function describeMetric(input) {
    return createAnalyticsMetricDefinition(input);
  }

  /**
   * Deterministic aggregation over caller-supplied observations + validated query.
   * Does not fetch runtime sources.
   *
   * @param {unknown} queryInput
   * @param {unknown} observations
   * @param {unknown} [context]
   */
  function aggregate(queryInput, observations, context = {}) {
    const queryResult = validateQuery(queryInput);
    if (!queryResult.ok) return queryResult;

    const descriptor = queryResult.value;
    const missingDataSemantics =
      isPlainObject(context) && typeof context.missingDataSemantics === "string"
        ? context.missingDataSemantics
        : undefined;

    const aggregateResult = aggregateExplicit(observations, {
      aggregationKind: descriptor.aggregationKind,
      missingDataSemantics,
      rateDenominator:
        isPlainObject(context) && "rateDenominator" in context
          ? context.rateDenominator
          : undefined,
    });
    if (!aggregateResult.ok) return aggregateResult;

    if (!isPlainObject(context) || !isPlainObject(context.provenance)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SOURCE_REQUIRED,
          "aggregate requires context.provenance",
          "context.provenance"
        )
      );
    }

    const generatedAt =
      isPlainObject(context) && isValidIsoTimestamp(context.generatedAt)
        ? String(context.generatedAt).trim()
        : nowIso();

    const resultBuild = createAnalyticsResult({
      metricId: descriptor.metricId,
      metricVersion: descriptor.metricVersion,
      tenantScope: descriptor.tenantScope,
      requestedWindow: descriptor.timeWindow,
      effectiveWindow:
        isPlainObject(context) && context.effectiveWindow
          ? context.effectiveWindow
          : descriptor.timeWindow,
      generatedAt,
      provenance: context.provenance,
      freshness:
        isPlainObject(context) && isNonEmptyString(context.freshness)
          ? context.freshness
          : ANALYTICS_FRESHNESS_STATE.UNKNOWN,
      warnings: Array.isArray(context.warnings) ? context.warnings : [],
      dataPoints: [
        {
          key: "aggregate",
          value: aggregateResult.value.value,
          missing: aggregateResult.value.value === null,
        },
      ],
      series: [],
    });

    if (!resultBuild.ok) return resultBuild;

    return ok(
      deepFreeze({
        descriptor,
        aggregation: aggregateResult.value,
        result: resultBuild.value,
      })
    );
  }

  /**
   * Read-path entry: validates query only. Runtime source adapters are deferred.
   * @param {unknown} queryInput
   */
  function query(queryInput) {
    return validateQuery(queryInput);
  }

  /** @type {Record<string, unknown>} */
  const facade = {
    validateQuery,
    describeMetric,
    aggregate,
    query,
  };

  // Explicit write/command surface rejection for certification tests.
  for (const writeName of [
    "write",
    "command",
    "mutate",
    "insert",
    "update",
    "upsert",
    "delete",
    "save",
  ]) {
    Object.defineProperty(facade, writeName, {
      enumerable: false,
      configurable: false,
      get() {
        return () =>
          fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED,
              WRITE_REJECT_MESSAGE,
              writeName
            )
          );
      },
    });
  }

  return Object.freeze(facade);
}
