/**
 * Read-only Competition Analytics facade / runtime (I&A-06).
 * Composes source adapter + guards + projections + optional dashboard/historical.
 * No global singleton. No write/persist surface. No Competition Engine imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import {
  clonePlain,
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";
import { createCompetitionAnalyticsQuery } from "./query.js";
import {
  createCompetitionAnalyticsSourceRequest,
  isCompetitionAnalyticsSourceAdapter,
  wrapCompetitionSourceFailure,
} from "./sourceAdapter.js";
import { guardCompetitionAnalyticsSnapshot } from "./guards.js";
import { projectCompetitionSummary } from "./projections.js";
import { composeCompetitionHistoricalObservations } from "./historical.js";
import { composeCompetitionDashboardPayloads } from "./dashboardPayloads.js";
import {
  createCompetitionAnalyticsMetricCatalogEntries,
  createCompetitionAnalyticsMetricDefinitions,
} from "./metrics.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyCompetitionAnalyticsFacade does not expose write/command operations";

/**
 * @param {unknown} deps
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionAnalyticsFacade(deps) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
        "createCompetitionAnalyticsFacade requires a dependencies object",
        "deps"
      )
    );
  }

  const sourceAdapter = deps.sourceAdapter;
  if (!isCompetitionAnalyticsSourceAdapter(sourceAdapter)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
        "createCompetitionAnalyticsFacade requires sourceAdapter.load",
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
    return createCompetitionAnalyticsQuery(queryInput);
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

    const normalized = createCompetitionAnalyticsQuery(queryInput);
    if (!normalized.ok) return normalized;

    if (inputSnapshot !== null && JSON.stringify(queryInput) !== inputSnapshot) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
          "Competition analytics query input must not be mutated",
          "query"
        )
      );
    }

    const query = normalized.value;
    executionCounter += 1;
    const executionId =
      typeof optionsObj.executionId === "string" && optionsObj.executionId.trim()
        ? String(optionsObj.executionId).trim()
        : `ia06-${executionCounter}-${query.context.competitionId}`;

    const sourceRequestResult = createCompetitionAnalyticsSourceRequest({
      context: query.context,
      executionId,
      allowMixedCompetitionVersions: query.allowMixedCompetitionVersions,
    });
    if (!sourceRequestResult.ok) return sourceRequestResult;

    let sourceResponse;
    try {
      sourceResponse = sourceAdapter.load(sourceRequestResult.value);
    } catch (error) {
      return wrapCompetitionSourceFailure(error);
    }

    if (
      sourceResponse &&
      typeof sourceResponse === "object" &&
      typeof sourceResponse.then === "function"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_SOURCE_FAILURE,
          "Async competition analytics source adapters are deferred",
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
          code === ANALYTICS_ERROR_CODE.COMPETITION_SOURCE_FAILURE ||
          code === ANALYTICS_ERROR_CODE.COMPETITION_TENANT_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.COMPETITION_ID_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.COMPETITION_VERSION_MIXED ||
          code === ANALYTICS_ERROR_CODE.COMPETITION_ISOLATION_VIOLATION
        ) {
          return sourceResponse;
        }
        return wrapCompetitionSourceFailure(sourceResponse.error);
      }
      return wrapCompetitionSourceFailure(sourceResponse);
    }

    const snapshot = sourceResponse.value.snapshot;
    const guard = guardCompetitionAnalyticsSnapshot(query.context, snapshot, {
      allowMixedCompetitionVersions: query.allowMixedCompetitionVersions,
    });
    if (!guard.ok) return guard;

    const generatedAt = nowIso();
    const summaryResult = projectCompetitionSummary(snapshot, {
      onTimeThresholdSeconds: query.onTimeThresholdSeconds,
      exclusionPolicy: query.exclusionPolicy,
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
      isCanonicalCompetitionState: false,
      isCanonicalModuleState: false,
    };

    if (query.includeHistoricalObservations) {
      const historical = composeCompetitionHistoricalObservations(
        summaryResult.value,
        { observedAt: snapshot.sourceTimestamp || generatedAt }
      );
      if (!historical.ok) return historical;
      result.historicalObservations = historical.value;
    }

    if (query.includeDashboardPayloads) {
      const dashboard = composeCompetitionDashboardPayloads(
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
    projectSummary: projectCompetitionSummary,
    composeHistoricalObservations: composeCompetitionHistoricalObservations,
    composeDashboardPayloads: composeCompetitionDashboardPayloads,
    createMetricDefinitions: createCompetitionAnalyticsMetricDefinitions,
    createMetricCatalogEntries: createCompetitionAnalyticsMetricCatalogEntries,
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
export function createReadOnlyCompetitionAnalyticsFacade(deps) {
  return createCompetitionAnalyticsFacade(deps);
}
