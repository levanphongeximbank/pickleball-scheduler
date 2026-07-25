/**
 * Read-only Customer / Player Analytics facade / runtime (I&A-08).
 * Composes source adapter + guards + projections + optional dashboard/historical.
 * No global singleton. No write/persist surface. No Customer/Player/CRM imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createCustomerPlayerAnalyticsQuery } from "./query.js";
import {
  createCustomerPlayerAnalyticsSourceRequest,
  isCustomerPlayerAnalyticsSourceAdapter,
  wrapCustomerPlayerSourceFailure,
} from "./sourceAdapter.js";
import { guardCustomerPlayerAnalyticsSnapshot } from "./guards.js";
import { projectCustomerPlayerSummary } from "./projections.js";
import { composeCustomerPlayerHistoricalObservations } from "./historical.js";
import { composeCustomerPlayerDashboardPayloads } from "./dashboardPayloads.js";
import {
  createCustomerPlayerAnalyticsMetricCatalogEntries,
  createCustomerPlayerAnalyticsMetricDefinitions,
} from "./metrics.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyCustomerPlayerAnalyticsFacade does not expose write/command operations";

/**
 * @param {unknown} deps
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerPlayerAnalyticsFacade(deps) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_QUERY_INVALID,
        "createCustomerPlayerAnalyticsFacade requires a dependencies object",
        "deps"
      )
    );
  }

  const sourceAdapter = deps.sourceAdapter;
  if (!isCustomerPlayerAnalyticsSourceAdapter(sourceAdapter)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_QUERY_INVALID,
        "createCustomerPlayerAnalyticsFacade requires sourceAdapter.load",
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
    return createCustomerPlayerAnalyticsQuery(queryInput);
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

    const normalized = createCustomerPlayerAnalyticsQuery(queryInput);
    if (!normalized.ok) return normalized;

    if (inputSnapshot !== null && JSON.stringify(queryInput) !== inputSnapshot) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_QUERY_INVALID,
          "Customer/Player analytics query input must not be mutated",
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
        : `ia08-${executionCounter}-${tenantId}`;

    const sourceRequestResult = createCustomerPlayerAnalyticsSourceRequest({
      context: query.context,
      executionId,
    });
    if (!sourceRequestResult.ok) return sourceRequestResult;

    let sourceResponse;
    try {
      sourceResponse = sourceAdapter.load(sourceRequestResult.value);
    } catch (error) {
      return wrapCustomerPlayerSourceFailure(error);
    }

    if (
      sourceResponse &&
      typeof sourceResponse === "object" &&
      typeof sourceResponse.then === "function"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SOURCE_FAILURE,
          "Async customer/player analytics source adapters are deferred",
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
          code === ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SOURCE_FAILURE ||
          code === ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TENANT_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_CUSTOMER_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_PLAYER_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_LINK_TENANT_MISMATCH ||
          code === ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_ISOLATION_VIOLATION
        ) {
          return sourceResponse;
        }
        return wrapCustomerPlayerSourceFailure(sourceResponse.error);
      }
      return wrapCustomerPlayerSourceFailure(sourceResponse);
    }

    const snapshot = sourceResponse.value.snapshot;
    const guard = guardCustomerPlayerAnalyticsSnapshot(query.context, snapshot);
    if (!guard.ok) return guard;

    const generatedAt = nowIso();
    const summaryResult = projectCustomerPlayerSummary(snapshot, {
      timeWindow: query.timeWindow,
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
      isCanonicalCustomerPlayerState: false,
      isCanonicalModuleState: false,
    };

    if (query.includeHistoricalObservations) {
      const historical = composeCustomerPlayerHistoricalObservations(
        summaryResult.value,
        { observedAt: snapshot.sourceTimestamp || generatedAt }
      );
      if (!historical.ok) return historical;
      result.historicalObservations = historical.value;
    }

    if (query.includeDashboardPayloads) {
      const dashboard = composeCustomerPlayerDashboardPayloads(
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
    projectSummary: projectCustomerPlayerSummary,
    composeHistoricalObservations: composeCustomerPlayerHistoricalObservations,
    composeDashboardPayloads: composeCustomerPlayerDashboardPayloads,
    createMetricDefinitions: createCustomerPlayerAnalyticsMetricDefinitions,
    createMetricCatalogEntries: createCustomerPlayerAnalyticsMetricCatalogEntries,
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
export function createReadOnlyCustomerPlayerAnalyticsFacade(deps) {
  return createCustomerPlayerAnalyticsFacade(deps);
}
