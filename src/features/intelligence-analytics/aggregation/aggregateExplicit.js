/**
 * Deterministic aggregation over explicit numeric observations.
 * Does not read database/localStorage. Does not import business-module rules.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  ANALYTICS_AGGREGATION_KIND,
  ANALYTICS_MISSING_DATA_SEMANTICS,
} from "../contracts/enums.js";
import { deepFreeze, isFiniteNumber, isPlainObject } from "../contracts/shared.js";

/**
 * @typedef {{
 *   value: number | null | undefined,
 *   weight?: number,
 * }} AnalyticsObservation
 *
 * @typedef {{
 *   aggregationKind: string,
 *   missingDataSemantics?: string,
 *   rateDenominator?: number,
 * }} AggregateExplicitOptions
 *
 * @typedef {{
 *   aggregationKind: string,
 *   value: number | null,
 *   observationCount: number,
 *   includedCount: number,
 *   omittedCount: number,
 *   missingCount: number,
 *   invalidCount: number,
 * }} AggregateExplicitResult
 */

/**
 * @param {unknown} observations
 * @param {unknown} options
 * @returns {import("../contracts/result.js").Result}
 */
export function aggregateExplicit(observations, options) {
  if (!Array.isArray(observations)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "aggregateExplicit requires an observations array",
        "observations"
      )
    );
  }
  if (!isPlainObject(options)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_INPUT,
        "aggregateExplicit requires an options object",
        "options"
      )
    );
  }

  const aggregationKind =
    typeof options.aggregationKind === "string" ? options.aggregationKind.trim() : "";
  if (!Object.values(ANALYTICS_AGGREGATION_KIND).includes(aggregationKind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.UNSUPPORTED_AGGREGATION,
        `Unsupported aggregation kind: ${aggregationKind || "(empty)"}`,
        "options.aggregationKind",
        { aggregationKind }
      )
    );
  }

  const missingDataSemantics =
    typeof options.missingDataSemantics === "string" && options.missingDataSemantics.trim()
      ? options.missingDataSemantics.trim()
      : ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL;

  if (!Object.values(ANALYTICS_MISSING_DATA_SEMANTICS).includes(missingDataSemantics)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.MISSING_DATA_POLICY_VIOLATION,
        `Unsupported missing-data semantics: ${missingDataSemantics}`,
        "options.missingDataSemantics"
      )
    );
  }

  /** @type {number[]} */
  const included = [];
  let omittedCount = 0;
  let missingCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < observations.length; i += 1) {
    const raw = observations[i];
    const value = isPlainObject(raw) ? raw.value : raw;

    if (value === null || value === undefined) {
      missingCount += 1;
      if (missingDataSemantics === ANALYTICS_MISSING_DATA_SEMANTICS.FAIL) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.MISSING_DATA_POLICY_VIOLATION,
            "Missing observation value violates FAIL missing-data semantics",
            `observations[${i}]`,
            { index: i }
          )
        );
      }
      if (missingDataSemantics === ANALYTICS_MISSING_DATA_SEMANTICS.OMIT) {
        omittedCount += 1;
        continue;
      }
      if (missingDataSemantics === ANALYTICS_MISSING_DATA_SEMANTICS.COALESCE_ZERO) {
        included.push(0);
        continue;
      }
      // PRESERVE_NULL: keep as structural missing; do not coerce into numeric set.
      omittedCount += 1;
      continue;
    }

    if (!isFiniteNumber(value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT,
          "Observation value must be a finite number, null, or undefined",
          `observations[${i}]`,
          { index: i, value, invalidCount: invalidCount + 1 }
        )
      );
    }

    included.push(value);
  }

  /** @type {number | null} */
  let aggregateValue = null;

  if (included.length === 0) {
    if (missingDataSemantics === ANALYTICS_MISSING_DATA_SEMANTICS.COALESCE_ZERO) {
      aggregateValue = 0;
    }
  } else if (aggregationKind === ANALYTICS_AGGREGATION_KIND.COUNT) {
    aggregateValue = included.length;
  } else if (aggregationKind === ANALYTICS_AGGREGATION_KIND.SUM) {
    aggregateValue = included.reduce((sum, n) => sum + n, 0);
  } else if (aggregationKind === ANALYTICS_AGGREGATION_KIND.AVERAGE) {
    const sum = included.reduce((acc, n) => acc + n, 0);
    aggregateValue = sum / included.length;
  } else if (aggregationKind === ANALYTICS_AGGREGATION_KIND.RATE) {
    const denominator =
      options.rateDenominator === undefined ? included.length : options.rateDenominator;
    if (!isFiniteNumber(denominator) || denominator <= 0) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_NUMERIC_INPUT,
          "RATE aggregation requires a positive finite rateDenominator (or non-empty included set)",
          "options.rateDenominator",
          { rateDenominator: denominator }
        )
      );
    }
    const numerator = included.reduce((sum, n) => sum + n, 0);
    aggregateValue = numerator / denominator;
  }

  /** @type {AggregateExplicitResult} */
  const result = {
    aggregationKind,
    value: aggregateValue,
    observationCount: observations.length,
    includedCount: included.length,
    omittedCount,
    missingCount,
    invalidCount,
  };

  return ok(deepFreeze(result));
}
