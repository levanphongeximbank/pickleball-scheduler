/**
 * Presentation-neutral Competition dashboard/report payload composers (I&A-06).
 * Reuses I&A-04 payload contracts — no React / route / UI wiring.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE, ANALYTICS_GRANULARITY } from "../contracts/enums.js";
import {
  createAnalyticsBreakdownPayload,
  createAnalyticsDataState,
  createAnalyticsKpiPayload,
  createAnalyticsTablePayload,
  createAnalyticsTimeSeriesPayload,
} from "../dashboard-reporting/payloads.js";
import { ANALYTICS_DATA_STATE } from "../dashboard-reporting/enums.js";
import { deepFreeze, isPlainObject, isValidIsoTimestamp } from "../contracts/shared.js";
import { COMPETITION_ANALYTICS_METHOD_VERSION } from "./enums.js";
import { COMPETITION_ANALYTICS_METRIC_IDS } from "./metrics.js";

const DEFAULT_WINDOW = Object.freeze({
  startAt: "1970-01-01T00:00:00.000Z",
  endAt: "9999-12-31T23:59:59.999Z",
  inclusive: true,
  timezone: "UTC",
});

/**
 * @param {unknown} summary
 * @returns {import("../contracts/result.js").Result}
 */
function buildDataState(summary) {
  let state = ANALYTICS_DATA_STATE.READY;
  if (summary.incompleteSnapshot) {
    state = ANALYTICS_DATA_STATE.PARTIAL;
  } else if (summary.freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
    state = ANALYTICS_DATA_STATE.STALE;
  } else if (summary.totalMatchCount === 0 && summary.participantCount === 0) {
    state = ANALYTICS_DATA_STATE.EMPTY;
  }

  /** @type {Record<string, unknown>} */
  const input = {
    state,
    warnings: summary.warnings || [],
  };
  if (summary.freshness) input.freshness = summary.freshness;
  if (summary.provenance) input.provenance = summary.provenance;

  return createAnalyticsDataState(input);
}

/**
 * @param {Record<string, number>} distribution
 * @returns {{ categories: string[], values: number[] }}
 */
function distributionToCategories(distribution) {
  const categories = Object.keys(distribution).sort();
  const values = categories.map((key) => distribution[key]);
  return { categories, values };
}

/**
 * Compose competition dashboard/report payloads from a summary projection.
 * @param {unknown} summary
 * @param {{
 *   historicalSeries?: unknown,
 *   effectiveWindow?: unknown,
 * }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function composeCompetitionDashboardPayloads(summary, options = {}) {
  if (!isPlainObject(summary)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "composeCompetitionDashboardPayloads requires a summary",
        "summary"
      )
    );
  }

  const dataStateResult = buildDataState(summary);
  if (!dataStateResult.ok) return dataStateResult;
  const dataState = dataStateResult.value;

  const effectiveWindow = isPlainObject(options.effectiveWindow)
    ? options.effectiveWindow
    : isPlainObject(summary.requestedWindow)
      ? summary.requestedWindow
      : {
          ...DEFAULT_WINDOW,
          ...(isValidIsoTimestamp(summary.sourceTimestamp)
            ? {
                startAt: summary.sourceTimestamp,
                endAt: summary.generatedAt || summary.sourceTimestamp,
              }
            : {}),
        };

  const provenance = summary.provenance;
  if (!provenance) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "summary.provenance is required for dashboard payloads",
        "summary.provenance"
      )
    );
  }

  const kpiDefs = [
    [
      "participants",
      COMPETITION_ANALYTICS_METRIC_IDS.PARTICIPANTS_COUNT,
      summary.participantCount,
      "count",
    ],
    [
      "entries",
      COMPETITION_ANALYTICS_METRIC_IDS.ENTRIES_COUNT,
      summary.entryCount,
      "count",
    ],
    [
      "progress",
      COMPETITION_ANALYTICS_METRIC_IDS.PROGRESS_PERCENTAGE,
      summary.progressPercentage,
      "percent",
    ],
    [
      "completion_rate",
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_COMPLETION_RATE,
      summary.completionRate,
      "ratio",
    ],
    [
      "acceptance_rate",
      COMPETITION_ANALYTICS_METRIC_IDS.RESULTS_ACCEPTANCE_RATE,
      summary.acceptanceRate,
      "ratio",
    ],
    [
      "schedule_adherence",
      COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_ADHERENCE_RATE,
      summary.scheduleAdherence?.adherenceRate,
      "ratio",
    ],
  ];

  /** @type {Record<string, unknown>} */
  const kpis = {};
  for (const [key, metricId, value, unit] of kpiDefs) {
    const created = createAnalyticsKpiPayload({
      metricId,
      metricVersion: "1.0.0",
      value: value === undefined ? null : value,
      unit,
      effectiveWindow,
      provenance,
      dataState,
      label: key,
    });
    if (!created.ok) return created;
    kpis[key] = created.value;
  }

  const lifecycle = distributionToCategories(
    summary.distributions?.matchLifecycleDistribution || {}
  );
  const lifecycleBreakdown = createAnalyticsBreakdownPayload({
    metricId: COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_LIFECYCLE_DISTRIBUTION,
    metricVersion: "1.0.0",
    dimension: "lifecycleStatus",
    categories: lifecycle.categories,
    values: lifecycle.values,
    provenance,
    dataState,
  });
  if (!lifecycleBreakdown.ok) return lifecycleBreakdown;

  const registration = distributionToCategories(
    summary.distributions?.registrationStatusDistribution || {}
  );
  const registrationBreakdown = createAnalyticsBreakdownPayload({
    metricId:
      COMPETITION_ANALYTICS_METRIC_IDS.REGISTRATIONS_STATUS_DISTRIBUTION,
    metricVersion: "1.0.0",
    dimension: "registrationStatus",
    categories: registration.categories,
    values: registration.values,
    provenance,
    dataState,
  });
  if (!registrationBreakdown.ok) return registrationBreakdown;

  const acceptance = distributionToCategories(
    summary.distributions?.resultAcceptanceDistribution || {}
  );
  const acceptanceBreakdown = createAnalyticsBreakdownPayload({
    metricId: COMPETITION_ANALYTICS_METRIC_IDS.RESULTS_ACCEPTANCE_RATE,
    metricVersion: "1.0.0",
    dimension: "acceptanceStatus",
    categories: acceptance.categories,
    values: acceptance.values,
    provenance,
    dataState,
  });
  if (!acceptanceBreakdown.ok) return acceptanceBreakdown;

  const durationEntries = Object.entries(
    summary.durationSummary?.durationDistribution || {}
  ).sort(([a], [b]) => a.localeCompare(b));

  const durationTable = createAnalyticsTablePayload({
    columns: [
      { columnId: "bucket", label: "Duration bucket" },
      { columnId: "count", label: "Count" },
    ],
    rows: durationEntries.map(([bucket, count], index) => ({
      rowId: `duration-${index}-${bucket}`,
      cells: { bucket, count },
    })),
    dataState,
    provenance,
  });
  if (!durationTable.ok) return durationTable;

  /** @type {unknown | undefined} */
  let timeSeries;
  if (options.historicalSeries && isPlainObject(options.historicalSeries)) {
    const seriesResult = createAnalyticsTimeSeriesPayload({
      metricId:
        options.historicalSeries.metricId ||
        COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_COMPLETED_COUNT,
      metricVersion: options.historicalSeries.metricVersion || "1.0.0",
      seriesId:
        options.historicalSeries.seriesId || "competition-matches-completed",
      granularity:
        options.historicalSeries.granularity || ANALYTICS_GRANULARITY.DAY,
      effectiveWindow:
        options.historicalSeries.effectiveWindow || effectiveWindow,
      points: options.historicalSeries.points || [],
      dataState,
      provenance,
    });
    if (!seriesResult.ok) return seriesResult;
    timeSeries = seriesResult.value;
  }

  return ok(
    deepFreeze({
      kpis: Object.freeze(kpis),
      lifecycleBreakdown: lifecycleBreakdown.value,
      registrationBreakdown: registrationBreakdown.value,
      acceptanceBreakdown: acceptanceBreakdown.value,
      durationTable: durationTable.value,
      ...(timeSeries ? { matchesTimeSeries: timeSeries } : {}),
      dataState,
      analyticalMethodVersion: COMPETITION_ANALYTICS_METHOD_VERSION.DASHBOARD,
      isCanonicalCompetitionState: false,
    })
  );
}
