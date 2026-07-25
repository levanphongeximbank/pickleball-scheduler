/**
 * In-memory historical source adapter for certification (I&A-05).
 * Reuses I&A-03 observation/source contracts — no DB / browser storage / Supabase.
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
import { createAnalyticsObservation } from "../runtime/observation.js";
import {
  createAnalyticsSourceRequest,
  createAnalyticsSourceResponse,
  wrapSourceFailure,
} from "../runtime/sourceAdapter.js";
import { createAnalyticsHistoricalObservation } from "./series.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryHistoricalSourceAdapter(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_SOURCE_FAILURE,
        "createInMemoryHistoricalSourceAdapter input must be a plain object",
        "input"
      )
    );
  }

  if (!Array.isArray(input.observations)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_SOURCE_FAILURE,
        "createInMemoryHistoricalSourceAdapter requires observations[]",
        "observations"
      )
    );
  }

  /** @type {unknown[]} */
  const stored = [];
  for (let i = 0; i < input.observations.length; i += 1) {
    // Prefer historical observation validation; fall back to IA-03 observation.
    const historical = createAnalyticsHistoricalObservation(input.observations[i]);
    if (historical.ok) {
      stored.push(historical.value);
      continue;
    }
    const runtimeObs = createAnalyticsObservation(input.observations[i]);
    if (!runtimeObs.ok) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.HISTORICAL_OBSERVATION_INVALID,
          runtimeObs.error.message,
          `observations[${i}]`,
          runtimeObs.error.details
        )
      );
    }
    stored.push(runtimeObs.value);
  }

  const frozen = deepFreeze(clonePlain(stored));

  let defaultProvenance;
  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    defaultProvenance = provenanceResult.value;
  } else if (frozen.length > 0 && frozen[0].provenance) {
    defaultProvenance = frozen[0].provenance;
  } else {
    const provenanceResult = createAnalyticsMetricProvenance({
      source: {
        sourceId: "in-memory-historical-explicit",
        sourceKind: "explicit_input",
        ownerModule: "intelligence-analytics",
        reference: "ia-05-certification",
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

  const failMode = input.failMode;

  /**
   * @param {unknown} requestInput
   */
  function query(requestInput) {
    try {
      if (failMode === "throw") {
        throw new Error("certification source throw");
      }
      if (failMode === "unavailable") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
            "Historical certification source unavailable",
            "sourceAdapter"
          )
        );
      }

      const requestResult = createAnalyticsSourceRequest(requestInput);
      if (!requestResult.ok) return requestResult;
      const request = requestResult.value;

      const filtered = frozen.filter((obs) => {
        if (obs.metricId !== request.metricId) return false;
        if (obs.metricVersion !== request.metricVersion) return false;
        if (
          request.tenantScope?.tenantId &&
          obs.tenantScope?.tenantId &&
          obs.tenantScope.tenantId !== request.tenantScope.tenantId
        ) {
          return false;
        }
        return true;
      });

      return createAnalyticsSourceResponse({
        observations: clonePlain(filtered),
        provenance: defaultProvenance,
        freshness,
        ...(sourceTimestamp ? { sourceTimestamp } : {}),
      });
    } catch (error) {
      return wrapSourceFailure(error);
    }
  }

  return ok(
    Object.freeze({
      query,
      kind: "in-memory-historical",
      observationCount: frozen.length,
    })
  );
}
