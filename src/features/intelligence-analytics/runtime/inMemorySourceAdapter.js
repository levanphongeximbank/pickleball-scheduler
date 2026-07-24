/**
 * Explicit in-memory source adapter for certification and targeted tests.
 * Does not read files, browser storage, database, or production datasets.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import {
  clonePlain,
  deepFreeze,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { createAnalyticsObservation } from "./observation.js";
import {
  createAnalyticsSourceRequest,
  createAnalyticsSourceResponse,
  wrapSourceFailure,
} from "./sourceAdapter.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryAnalyticsSourceAdapter(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
        "createInMemoryAnalyticsSourceAdapter input must be a plain object",
        "input"
      )
    );
  }

  if (!Array.isArray(input.observations)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
        "createInMemoryAnalyticsSourceAdapter requires an observations array",
        "observations"
      )
    );
  }

  /** @type {import("./observation.js").AnalyticsObservation[]} */
  const stored = [];
  for (let i = 0; i < input.observations.length; i += 1) {
    const created = createAnalyticsObservation(input.observations[i]);
    if (!created.ok) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_OBSERVATION,
          created.error.message,
          `observations[${i}]`,
          created.error.details
        )
      );
    }
    stored.push(created.value);
  }

  const frozenObservations = deepFreeze(clonePlain(stored));

  /** @type {import("../contracts/source.js").AnalyticsMetricProvenance} */
  let defaultProvenance;
  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    defaultProvenance = provenanceResult.value;
  } else if (frozenObservations.length > 0) {
    defaultProvenance = frozenObservations[0].provenance;
  } else {
    const provenanceResult = createAnalyticsMetricProvenance({
      source: {
        sourceId: "in-memory-explicit",
        sourceKind: "explicit_input",
        ownerModule: "intelligence-analytics",
        reference: "in-memory-adapter",
      },
    });
    if (!provenanceResult.ok) return provenanceResult;
    defaultProvenance = provenanceResult.value;
  }

  const freshness = Object.values(ANALYTICS_FRESHNESS_STATE).includes(
    /** @type {string} */ (input.freshness)
  )
    ? /** @type {string} */ (input.freshness)
    : ANALYTICS_FRESHNESS_STATE.FRESH;

  const sourceTimestamp =
    typeof input.sourceTimestamp === "string" &&
    isValidIsoTimestamp(input.sourceTimestamp)
      ? String(input.sourceTimestamp).trim()
      : undefined;

  const failMode =
    typeof input.failMode === "string" ? String(input.failMode).trim() : null;

  /**
   * @param {unknown} requestInput
   */
  function query(requestInput) {
    try {
      if (failMode === "unavailable") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
            "In-memory analytics source is marked unavailable",
            "sourceAdapter"
          )
        );
      }
      if (failMode === "failure") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
            "In-memory analytics source forced failure",
            "sourceAdapter"
          )
        );
      }

      const requestResult = createAnalyticsSourceRequest(requestInput);
      if (!requestResult.ok) return requestResult;
      const request = requestResult.value;

      const matched = frozenObservations.filter(
        (obs) =>
          obs.metricId === request.metricId &&
          obs.metricVersion === request.metricVersion
      );

      return createAnalyticsSourceResponse({
        observations: matched,
        provenance: defaultProvenance,
        freshness,
        sourceTimestamp,
      });
    } catch (error) {
      return wrapSourceFailure(error);
    }
  }

  /** @type {Record<string, unknown>} */
  const adapter = {
    query,
  };

  const rejectedWriteOps = [
    "create",
    "update",
    "delete",
    "write",
    "mutate",
    "insert",
    "upsert",
    "save",
  ];
  for (let i = 0; i < rejectedWriteOps.length; i += 1) {
    const rejectedOp = rejectedWriteOps[i];
    Object.defineProperty(adapter, rejectedOp, {
      enumerable: false,
      configurable: false,
      get() {
        return () =>
          fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED,
              "AnalyticsSourceAdapter is read-only",
              rejectedOp
            )
          );
      },
    });
  }

  return ok(Object.freeze(adapter));
}
