/**
 * Read-only Operational Alerts and Insights facade (I&A-10).
 * No global singleton. No write/persist/delivery surface.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createOperationalAlertsInsightsQuery } from "./query.js";
import {
  createOperationalSignalSourceRequest,
  isOperationalSignalSourceAdapter,
  wrapOperationalAlertsSourceFailure,
} from "./sourceAdapter.js";
import { guardOperationalSignalsSnapshot } from "./guards.js";
import { evaluateOperationalAlertsInsights } from "./evaluation.js";
import { composeOperationalAlertsInsightsDashboardPayloads } from "./dashboardPayloads.js";
import {
  createOperationalAlertRuleCatalog,
  getFoundationOperationalAlertRuleCatalog,
} from "./catalog.js";
import {
  createAlertDeduplicationKey,
  createAlertCorrelationKey,
} from "./keys.js";
import { createAlertNotificationCandidate } from "./results.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyOperationalAlertsInsightsFacade does not expose write/command/delivery operations";

const RETAINED_SOURCE_ERROR_CODES = new Set([
  ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
  ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
  ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SOURCE_FAILURE,
  ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TENANT_MISMATCH,
  ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_ENTITY_MISMATCH,
  ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CURRENCY_MISMATCH,
  ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_ISOLATION_VIOLATION,
  ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_METRIC_VERSION_MISMATCH,
]);

/**
 * @param {unknown} deps
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalAlertsInsightsFacade(deps) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
        "createOperationalAlertsInsightsFacade requires a dependencies object",
        "deps"
      )
    );
  }

  const sourceAdapter = deps.sourceAdapter;
  if (!isOperationalSignalSourceAdapter(sourceAdapter)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
        "createOperationalAlertsInsightsFacade requires sourceAdapter.load",
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
    return createOperationalAlertsInsightsQuery(queryInput);
  }

  /**
   * @param {unknown} queryInput
   * @param {unknown} [options]
   */
  function evaluate(queryInput, options = {}) {
    const optionsObj = isPlainObject(options) ? options : {};
    const inputSnapshot = isPlainObject(queryInput)
      ? JSON.stringify(queryInput)
      : null;

    const normalized = createOperationalAlertsInsightsQuery(queryInput);
    if (!normalized.ok) return normalized;

    if (inputSnapshot !== null && JSON.stringify(queryInput) !== inputSnapshot) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
          "Operational alerts query input must not be mutated",
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
        : `ia10-${executionCounter}-${tenantId}`;

    const sourceRequestResult = createOperationalSignalSourceRequest({
      context: query.context,
      executionId,
    });
    if (!sourceRequestResult.ok) return sourceRequestResult;

    let sourceResponse;
    try {
      sourceResponse = sourceAdapter.load(sourceRequestResult.value);
    } catch (error) {
      return wrapOperationalAlertsSourceFailure(error);
    }

    if (
      sourceResponse &&
      typeof sourceResponse === "object" &&
      typeof sourceResponse.then === "function"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SOURCE_FAILURE,
          "Async operational alerts source adapters are deferred",
          "sourceAdapter"
        )
      );
    }

    if (!sourceResponse || sourceResponse.ok !== true) {
      if (sourceResponse && sourceResponse.ok === false) {
        const code = sourceResponse.error?.code;
        if (RETAINED_SOURCE_ERROR_CODES.has(code)) {
          return sourceResponse;
        }
        return wrapOperationalAlertsSourceFailure(sourceResponse.error);
      }
      return wrapOperationalAlertsSourceFailure(sourceResponse);
    }

    const snapshot = sourceResponse.value.snapshot;
    const guard = guardOperationalSignalsSnapshot(query.context, snapshot);
    if (!guard.ok) return guard;

    const evaluatedAt = nowIso();
    const evaluationResult = evaluateOperationalAlertsInsights({
      context: query.context,
      snapshot,
      evaluatedAt,
      timeWindow: query.timeWindow,
      ruleIds: query.ruleIds,
      priorAlerts: query.priorAlerts,
      acknowledgements: query.acknowledgements,
      includeNotificationCandidates: query.includeNotificationCandidates,
      catalog: optionsObj.catalog,
    });
    if (!evaluationResult.ok) return evaluationResult;

    /** @type {Record<string, unknown>} */
    const result = {
      query,
      evaluation: evaluationResult.value,
      snapshotMeta: deepFreeze({
        sourceTimestamp: snapshot.sourceTimestamp,
        freshness: snapshot.freshness,
        completeness: snapshot.completeness,
        provenance: snapshot.provenance,
        canonicalSourceRef: snapshot.canonicalSourceRef,
        signalCount: Array.isArray(snapshot.signals)
          ? snapshot.signals.length
          : 0,
      }),
      generatedAt: evaluatedAt,
      executionId,
      stale: snapshot.freshness === ANALYTICS_FRESHNESS_STATE.STALE,
      isCanonicalDomainState: false,
      isDeliveredNotification: false,
      isCanonicalModuleState: false,
    };

    if (query.includeDashboardPayloads) {
      const dashboard = composeOperationalAlertsInsightsDashboardPayloads(
        evaluationResult.value,
        {
          historicalSeries: optionsObj.historicalSeries,
          effectiveWindow: optionsObj.effectiveWindow || query.timeWindow,
        }
      );
      if (!dashboard.ok) return dashboard;
      result.dashboardPayloads = dashboard.value;
    }

    return ok(deepFreeze(clonePlain(result)));
  }

  /** @type {Record<string, unknown>} */
  const facade = {
    evaluate,
    analyze: evaluate,
    validate,
    composeDashboardPayloads: composeOperationalAlertsInsightsDashboardPayloads,
    createRuleCatalog: createOperationalAlertRuleCatalog,
    getFoundationCatalog: getFoundationOperationalAlertRuleCatalog,
    createDeduplicationKey: createAlertDeduplicationKey,
    createCorrelationKey: createAlertCorrelationKey,
    createNotificationCandidate: createAlertNotificationCandidate,
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
    "deliver",
    "send",
    "notify",
    "dispatch",
    "retry",
    "escalate",
    "acknowledge",
    "resolve",
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
 * @param {unknown} deps
 */
export function createReadOnlyOperationalAlertsInsightsFacade(deps) {
  return createOperationalAlertsInsightsFacade(deps);
}
