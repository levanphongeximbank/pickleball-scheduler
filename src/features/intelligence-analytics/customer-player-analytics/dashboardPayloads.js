/**
 * Presentation-neutral Customer / Player dashboard/report payloads (I&A-08).
 * Reuses I&A-04 payload contracts — no React / route / UI wiring.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE, ANALYTICS_GRANULARITY } from "../contracts/enums.js";
import {
  createAnalyticsBreakdownPayload,
  createAnalyticsDataState,
  createAnalyticsKpiPayload,
  createAnalyticsTimeSeriesPayload,
} from "../dashboard-reporting/payloads.js";
import { ANALYTICS_DATA_STATE } from "../dashboard-reporting/enums.js";
import { deepFreeze, isPlainObject, isValidIsoTimestamp } from "../contracts/shared.js";
import { CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION } from "./enums.js";
import { CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS } from "./metrics.js";

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
  } else if (summary.customerCount === 0 && summary.playerCount === 0) {
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
  const categories = Object.keys(distribution || {}).sort();
  const values = categories.map((key) => distribution[key]);
  return { categories, values };
}

/**
 * Compose Customer/Player dashboard/report payloads from a summary projection.
 * @param {unknown} summary
 * @param {{
 *   historicalSeries?: unknown,
 *   effectiveWindow?: unknown,
 * }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function composeCustomerPlayerDashboardPayloads(summary, options = {}) {
  if (!isPlainObject(summary)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "composeCustomerPlayerDashboardPayloads requires a summary",
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
      "customers",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_COUNT,
      summary.customerCount,
      "count",
    ],
    [
      "players",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_COUNT,
      summary.playerCount,
      "count",
    ],
    [
      "customer_linkage_rate",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_PLAYER_LINKAGE_RATE,
      summary.customerLinkageRate,
      "ratio",
    ],
    [
      "player_linkage_rate",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_CUSTOMER_LINKAGE_RATE,
      summary.playerLinkageRate,
      "ratio",
    ],
    [
      "customer_profile_completeness_rate",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_PROFILE_COMPLETENESS_RATE,
      summary.customerProfileCompletenessRate,
      "ratio",
    ],
    [
      "player_profile_completeness_rate",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_PROFILE_COMPLETENESS_RATE,
      summary.playerProfileCompletenessRate,
      "ratio",
    ],
    [
      "customer_activities",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_ACTIVITIES_COUNT,
      summary.customerActivityCount,
      "count",
    ],
    [
      "player_activities",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_ACTIVITIES_COUNT,
      summary.playerActivityCount,
      "count",
    ],
    [
      "competition_participations",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_COMPETITION_PARTICIPATIONS_COUNT,
      summary.participationCount,
      "count",
    ],
    [
      "club_memberships",
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_CLUB_MEMBERSHIPS_COUNT,
      summary.membershipCount,
      "count",
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

  const customerLifecycle = distributionToCategories(
    summary.customerLifecycleDistribution || {}
  );
  const customerLifecycleBreakdown = createAnalyticsBreakdownPayload({
    metricId: CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_LIFECYCLE_DISTRIBUTION,
    metricVersion: "1.0.0",
    dimension: "customerLifecycle",
    categories: customerLifecycle.categories,
    values: customerLifecycle.values,
    provenance,
    dataState,
  });
  if (!customerLifecycleBreakdown.ok) return customerLifecycleBreakdown;

  const playerLifecycle = distributionToCategories(
    summary.playerLifecycleDistribution || {}
  );
  const playerLifecycleBreakdown = createAnalyticsBreakdownPayload({
    metricId: CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_LIFECYCLE_DISTRIBUTION,
    metricVersion: "1.0.0",
    dimension: "playerLifecycle",
    categories: playerLifecycle.categories,
    values: playerLifecycle.values,
    provenance,
    dataState,
  });
  if (!playerLifecycleBreakdown.ok) return playerLifecycleBreakdown;

  /** @type {unknown | undefined} */
  let timeSeries;
  if (options.historicalSeries && isPlainObject(options.historicalSeries)) {
    const seriesResult = createAnalyticsTimeSeriesPayload({
      metricId:
        options.historicalSeries.metricId ||
        CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_COUNT,
      metricVersion: options.historicalSeries.metricVersion || "1.0.0",
      seriesId: options.historicalSeries.seriesId || "customer-player-growth",
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
      customerLifecycleBreakdown: customerLifecycleBreakdown.value,
      playerLifecycleBreakdown: playerLifecycleBreakdown.value,
      ...(timeSeries ? { customerPlayerTimeSeries: timeSeries } : {}),
      dataState,
      analyticalMethodVersion: CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.DASHBOARD,
      isCanonicalCustomerPlayerState: false,
    })
  );
}
