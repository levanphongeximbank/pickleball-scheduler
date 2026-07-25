/**
 * Read-only Venue / Court / Club Analytics facade / runtime (I&A-07).
 * Composes source adapter + guards + projections + optional dashboard/historical.
 * No global singleton. No write/persist surface. No Venue/Court/Club imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import {
  clonePlain,
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";
import { createVenueCourtClubAnalyticsQuery } from "./query.js";
import {
  createVenueCourtClubAnalyticsSourceRequest,
  isVenueCourtClubAnalyticsSourceAdapter,
  wrapVenueCourtClubSourceFailure,
} from "./sourceAdapter.js";
import { guardVenueCourtClubAnalyticsSnapshot } from "./guards.js";
import { projectVenueCourtClubSummary } from "./projections.js";
import { composeVenueCourtClubHistoricalObservations } from "./historical.js";
import { composeVenueCourtClubDashboardPayloads } from "./dashboardPayloads.js";
import {
  createVenueCourtClubAnalyticsMetricCatalogEntries,
  createVenueCourtClubAnalyticsMetricDefinitions,
} from "./metrics.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyVenueCourtClubAnalyticsFacade does not expose write/command operations";

/**
 * @param {unknown} deps
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueCourtClubAnalyticsFacade(deps) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_QUERY_INVALID,
        "createVenueCourtClubAnalyticsFacade requires a dependencies object",
        "deps"
      )
    );
  }

  const sourceAdapter = deps.sourceAdapter;
  if (!isVenueCourtClubAnalyticsSourceAdapter(sourceAdapter)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_QUERY_INVALID,
        "createVenueCourtClubAnalyticsFacade requires sourceAdapter.load",
        "deps.sourceAdapter"
      )
    );
  }

  const nowIso =
    typeof deps.nowIso === "function"
      ? deps.nowIso
      : () => new Date().toISOString();

  let executionCounter = 0;

  /**
   * Validate-only — never calls the source adapter.
   * @param {unknown} queryInput
   */
  function validate(queryInput) {
    return createVenueCourtClubAnalyticsQuery(queryInput);
  }

  /**
   * @param {unknown} queryInput
   * @param {unknown} [options]
   */
  function analyze(queryInput, options = {}) {
    const optionsObj = isPlainObject(options) ? options : {};
    const inputSnapshot = isPlainObject(queryInput)
      ? JSON.stringify(queryInput)
      : null;

    const normalized = createVenueCourtClubAnalyticsQuery(queryInput);
    if (!normalized.ok) return normalized;

    if (inputSnapshot !== null && JSON.stringify(queryInput) !== inputSnapshot) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_QUERY_INVALID,
          "Venue/Court/Club analytics query input must not be mutated",
          "query"
        )
      );
    }

    const query = normalized.value;
    executionCounter += 1;
    const tenantId = query.context.tenantScope.tenantId;
    const executionId =
      typeof optionsObj.executionId === "string" && optionsObj.executionId.trim()
        ? String(optionsObj.executionId).trim()
        : `ia07-${executionCounter}-${tenantId}`;

    const sourceRequestResult = createVenueCourtClubAnalyticsSourceRequest({
      context: query.context,
      executionId,
    });
    if (!sourceRequestResult.ok) return sourceRequestResult;

    let sourceResponse;
    try {
      sourceResponse = sourceAdapter.load(sourceRequestResult.value);
    } catch (error) {
      return wrapVenueCourtClubSourceFailure(error);
    }

    if (
      sourceResponse &&
      typeof sourceResponse === "object" &&
      typeof sourceResponse.then === "function"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SOURCE_FAILURE,
          "Async venue/court/club analytics source adapters are deferred",
          "sourceAdapter"
        )
      );
    }

    if (!sourceResponse || sourceResponse.ok !== true) {
      if (sourceResponse && sourceResponse.ok === false) {
        const code = sourceResponse.error?.code;
        if (
          code === ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE ||
          code === ANALYTICS_ERROR_CODE.SOURCE_FAILURE ||
          code === ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SOURCE_FAILURE ||
          code === ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_TENANT_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_VENUE_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_CLUB_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_VENUE_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_ISOLATION_VIOLATION
        ) {
          return sourceResponse;
        }
        return wrapVenueCourtClubSourceFailure(sourceResponse.error);
      }
      return wrapVenueCourtClubSourceFailure(sourceResponse);
    }

    const snapshot = sourceResponse.value.snapshot;
    const guard = guardVenueCourtClubAnalyticsSnapshot(query.context, snapshot);
    if (!guard.ok) return guard;

    const generatedAt = nowIso();
    const summaryResult = projectVenueCourtClubSummary(snapshot, {
      cancellationPolicy: query.cancellationPolicy,
      downtimeInclusionPolicy: query.downtimeInclusionPolicy,
      generatedAt,
    });
    if (!summaryResult.ok) return summaryResult;

    /** @type {Record<string, unknown>} */
    const result = {
      query,
      summary: summaryResult.value,
      snapshotMeta: deepFreeze({
        sourceTimestamp: snapshot.sourceTimestamp,
        freshness: snapshot.freshness,
        completeness: snapshot.completeness,
        provenance: snapshot.provenance,
        canonicalSourceRef: snapshot.canonicalSourceRef,
      }),
      generatedAt,
      executionId,
      stale: snapshot.freshness === ANALYTICS_FRESHNESS_STATE.STALE,
      isCanonicalVenueCourtClubState: false,
      isCanonicalModuleState: false,
    };

    if (query.includeHistoricalObservations) {
      const historical = composeVenueCourtClubHistoricalObservations(
        summaryResult.value,
        { observedAt: snapshot.sourceTimestamp || generatedAt }
      );
      if (!historical.ok) return historical;
      result.historicalObservations = historical.value;
    }

    if (query.includeDashboardPayloads) {
      const dashboard = composeVenueCourtClubDashboardPayloads(
        summaryResult.value,
        {
          historicalSeries: optionsObj.historicalSeries,
          effectiveWindow: optionsObj.effectiveWindow,
        }
      );
      if (!dashboard.ok) return dashboard;
      result.dashboardPayloads = dashboard.value;
    }

    return ok(deepFreeze(clonePlain(result)));
  }

  /** @type {Record<string, unknown>} */
  const facade = {
    analyze,
    validate,
    projectSummary: projectVenueCourtClubSummary,
    composeHistoricalObservations: composeVenueCourtClubHistoricalObservations,
    composeDashboardPayloads: composeVenueCourtClubDashboardPayloads,
    createMetricDefinitions: createVenueCourtClubAnalyticsMetricDefinitions,
    createMetricCatalogEntries: createVenueCourtClubAnalyticsMetricCatalogEntries,
  };

  const rejectedWriteOps = [
    "write",
    "command",
    "mutate",
    "insert",
    "update",
    "upsert",
    "delete",
    "save",
    "persist",
    "register",
  ];
  for (let i = 0; i < rejectedWriteOps.length; i += 1) {
    const rejectedOp = rejectedWriteOps[i];
    Object.defineProperty(facade, rejectedOp, {
      enumerable: false,
      configurable: false,
      get() {
        return () =>
          fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED,
              WRITE_REJECT_MESSAGE,
              rejectedOp
            )
          );
      },
    });
  }

  return ok(Object.freeze(facade));
}

/**
 * Alias emphasizing the read-only facade contract.
 * @param {unknown} deps
 */
export function createReadOnlyVenueCourtClubAnalyticsFacade(deps) {
  return createVenueCourtClubAnalyticsFacade(deps);
}
