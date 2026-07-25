/**
 * Presentation-neutral operational alerts / insights dashboard payloads
 * (I&A-10). Reuses I&A-04 — no React / route / UI wiring.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import {
  createAnalyticsBreakdownPayload,
  createAnalyticsDataState,
  createAnalyticsKpiPayload,
  createAnalyticsTablePayload,
  createAnalyticsTimeSeriesPayload,
} from "../dashboard-reporting/payloads.js";
import { ANALYTICS_DATA_STATE } from "../dashboard-reporting/enums.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import {
  ALERT_LIFECYCLE_STATE,
  ALERT_SEVERITY,
  OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION,
} from "./enums.js";

const DEFAULT_WINDOW = Object.freeze({
  startAt: "1970-01-01T00:00:00.000Z",
  endAt: "9999-12-31T23:59:59.999Z",
  inclusive: true,
  timezone: "UTC",
});

/**
 * @param {unknown} evaluation
 * @returns {import("../contracts/result.js").Result}
 */
function buildDataState(evaluation) {
  let state = ANALYTICS_DATA_STATE.READY;
  const alerts = evaluation.alerts || [];
  const insights = evaluation.insights || [];
  if (evaluation.freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
    state = ANALYTICS_DATA_STATE.STALE;
  } else if (evaluation.completeness === "partial") {
    state = ANALYTICS_DATA_STATE.PARTIAL;
  } else if (alerts.length === 0 && insights.length === 0) {
    state = evaluation.emptySignals
      ? ANALYTICS_DATA_STATE.EMPTY
      : ANALYTICS_DATA_STATE.READY;
  }

  /** @type {Record<string, unknown>} */
  const input = {
    state,
    warnings: evaluation.warnings || [],
  };
  if (evaluation.freshness) input.freshness = evaluation.freshness;
  if (evaluation.provenance) input.provenance = evaluation.provenance;
  return createAnalyticsDataState(input);
}

/**
 * @param {unknown[]} alerts
 * @param {string} key
 * @returns {Record<string, number>}
 */
function countBy(alerts, key) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const alert of alerts) {
    const value = String(alert[key] || "unknown");
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}

/**
 * @param {Record<string, number>} distribution
 */
function toBreakdown(distribution) {
  const categories = Object.keys(distribution).sort();
  return {
    categories,
    values: categories.map((key) => distribution[key]),
  };
}

/**
 * @param {string[]} columnIds
 */
function tableColumns(columnIds) {
  return Object.freeze(
    columnIds.map((columnId) =>
      Object.freeze({ columnId, label: columnId, valueType: "string" })
    )
  );
}

/**
 * @param {unknown} evaluation
 * @param {{ effectiveWindow?: unknown, historicalSeries?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function composeOperationalAlertsInsightsDashboardPayloads(
  evaluation,
  options = {}
) {
  if (!isPlainObject(evaluation)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "composeOperationalAlertsInsightsDashboardPayloads requires evaluation result",
        "evaluation"
      )
    );
  }

  const provenance = evaluation.provenance;
  if (!provenance) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "evaluation.provenance is required for dashboard payloads",
        "evaluation.provenance"
      )
    );
  }

  const dataStateResult = buildDataState(evaluation);
  if (!dataStateResult.ok) return dataStateResult;
  const dataState = dataStateResult.value;

  const effectiveWindow = isPlainObject(options.effectiveWindow)
    ? options.effectiveWindow
    : DEFAULT_WINDOW;

  const alerts = Array.isArray(evaluation.alerts) ? evaluation.alerts : [];
  const insights = Array.isArray(evaluation.insights) ? evaluation.insights : [];

  const openAlerts = alerts.filter(
    (alert) => alert.status === ALERT_LIFECYCLE_STATE.OPEN
  );
  const unresolvedHighCritical = alerts.filter(
    (alert) =>
      (alert.status === ALERT_LIFECYCLE_STATE.OPEN ||
        alert.status === ALERT_LIFECYCLE_STATE.ACKNOWLEDGED) &&
      (alert.severity === ALERT_SEVERITY.HIGH ||
        alert.severity === ALERT_SEVERITY.CRITICAL)
  );
  const dataQualityAlerts = alerts.filter(
    (alert) => alert.domain === "data_quality"
  );
  const staleSourceAlerts = alerts.filter(
    (alert) =>
      alert.freshness === ANALYTICS_FRESHNESS_STATE.STALE ||
      String(alert.ruleId || "").includes(".stale")
  );
  const suppressedAlerts = alerts.filter(
    (alert) => alert.status === ALERT_LIFECYCLE_STATE.SUPPRESSED
  );

  const openKpi = createAnalyticsKpiPayload({
    metricId: "operational.alerts.open_count",
    metricVersion: "1.0.0",
    value: openAlerts.length,
    unit: "count",
    effectiveWindow,
    dataState,
    provenance,
  });
  if (!openKpi.ok) return openKpi;

  const severityBreakdownInput = toBreakdown(countBy(alerts, "severity"));
  const severityBreakdown = createAnalyticsBreakdownPayload({
    metricId: "operational.alerts.by_severity",
    metricVersion: "1.0.0",
    dimension: "severity",
    categories: severityBreakdownInput.categories,
    values: severityBreakdownInput.values,
    effectiveWindow,
    dataState,
    provenance,
  });
  if (!severityBreakdown.ok) return severityBreakdown;

  const ruleBreakdownInput = toBreakdown(countBy(alerts, "ruleId"));
  const ruleBreakdown = createAnalyticsBreakdownPayload({
    metricId: "operational.alerts.by_rule",
    metricVersion: "1.0.0",
    dimension: "ruleId",
    categories: ruleBreakdownInput.categories,
    values: ruleBreakdownInput.values,
    effectiveWindow,
    dataState,
    provenance,
  });
  if (!ruleBreakdown.ok) return ruleBreakdown;

  const domainBreakdownInput = toBreakdown(countBy(alerts, "domain"));
  const domainBreakdown = createAnalyticsBreakdownPayload({
    metricId: "operational.alerts.by_domain",
    metricVersion: "1.0.0",
    dimension: "domain",
    categories: domainBreakdownInput.categories,
    values: domainBreakdownInput.values,
    effectiveWindow,
    dataState,
    provenance,
  });
  if (!domainBreakdown.ok) return domainBreakdown;

  const lifecycleBreakdownInput = toBreakdown(countBy(alerts, "status"));
  const lifecycleBreakdown = createAnalyticsBreakdownPayload({
    metricId: "operational.alerts.by_lifecycle",
    metricVersion: "1.0.0",
    dimension: "lifecycle",
    categories: lifecycleBreakdownInput.categories,
    values: lifecycleBreakdownInput.values,
    effectiveWindow,
    dataState,
    provenance,
  });
  if (!lifecycleBreakdown.ok) return lifecycleBreakdown;

  const dataQualityTable = createAnalyticsTablePayload({
    columns: tableColumns([
      "alertId",
      "ruleId",
      "severity",
      "status",
      "explanation",
    ]),
    rows: Object.freeze(
      dataQualityAlerts.map((alert, index) =>
        Object.freeze({
          rowId: String(alert.alertId || `dq-${index}`),
          cells: Object.freeze({
            alertId: alert.alertId,
            ruleId: alert.ruleId,
            severity: alert.severity,
            status: alert.status,
            explanation: alert.explanation,
          }),
        })
      )
    ),
    effectiveWindow,
    dataState,
    provenance,
  });
  if (!dataQualityTable.ok) return dataQualityTable;

  const insightTable = createAnalyticsTablePayload({
    columns: tableColumns(["insightId", "ruleId", "severity", "explanation"]),
    rows: Object.freeze(
      insights.map((insight, index) =>
        Object.freeze({
          rowId: String(insight.insightId || `insight-${index}`),
          cells: Object.freeze({
            insightId: insight.insightId,
            ruleId: insight.ruleId,
            severity: insight.severity,
            explanation: insight.explanation,
          }),
        })
      )
    ),
    effectiveWindow,
    dataState,
    provenance,
  });
  if (!insightTable.ok) return insightTable;

  const unresolvedTable = createAnalyticsTablePayload({
    columns: tableColumns(["alertId", "ruleId", "severity", "status"]),
    rows: Object.freeze(
      unresolvedHighCritical.map((alert, index) =>
        Object.freeze({
          rowId: String(alert.alertId || `unresolved-${index}`),
          cells: Object.freeze({
            alertId: alert.alertId,
            ruleId: alert.ruleId,
            severity: alert.severity,
            status: alert.status,
          }),
        })
      )
    ),
    effectiveWindow,
    dataState,
    provenance,
  });
  if (!unresolvedTable.ok) return unresolvedTable;

  /** @type {Record<string, unknown>} */
  const payloads = {
    kpis: deepFreeze({
      openAlerts: openKpi.value,
      unresolvedHighCriticalCount: unresolvedHighCritical.length,
      suppressedCount: suppressedAlerts.length,
      insightCount: insights.length,
    }),
    alertsBySeverityBreakdown: severityBreakdown.value,
    alertsByRuleBreakdown: ruleBreakdown.value,
    alertsByDomainBreakdown: domainBreakdown.value,
    alertLifecycleBreakdown: lifecycleBreakdown.value,
    dataQualityAlertsTable: dataQualityTable.value,
    insightFeedTable: insightTable.value,
    unresolvedHighCriticalTable: unresolvedTable.value,
    staleSourceAlertsCount: staleSourceAlerts.length,
    suppressedAlertsSummary: deepFreeze({
      count: suppressedAlerts.length,
      reasons: Object.freeze(
        suppressedAlerts
          .map((alert) => alert.suppression?.reason)
          .filter(Boolean)
      ),
    }),
    dataState,
    analyticalMethodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.DASHBOARD,
    isCanonicalModuleState: false,
  };

  if (isPlainObject(options.historicalSeries)) {
    const series = createAnalyticsTimeSeriesPayload({
      metricId: "operational.alerts.open_count",
      metricVersion: "1.0.0",
      seriesId: "operational.alerts.open_trend",
      granularity: options.historicalSeries.granularity || "day",
      effectiveWindow,
      points: options.historicalSeries.points || [],
      dataState,
      provenance,
    });
    if (!series.ok) return series;
    payloads.alertTrendTimeSeries = series.value;
  }

  return ok(deepFreeze(payloads));
}
