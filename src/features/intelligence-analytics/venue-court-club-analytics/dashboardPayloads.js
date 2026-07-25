/**
 * Presentation-neutral Venue / Court / Club dashboard/report payloads (I&A-07).
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
import { VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION } from "./enums.js";
import { VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS } from "./metrics.js";

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
  } else if (
    summary.venueCount === 0 &&
    summary.courtCount === 0 &&
    summary.clubCount === 0
  ) {
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
 * Compose venue/court/club dashboard/report payloads from a summary projection.
 * @param {unknown} summary
 * @param {{
 *   historicalSeries?: unknown,
 *   effectiveWindow?: unknown,
 * }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function composeVenueCourtClubDashboardPayloads(summary, options = {}) {
  if (!isPlainObject(summary)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "composeVenueCourtClubDashboardPayloads requires a summary",
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
      "venues",
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.VENUE_COUNT,
      summary.venueCount,
      "count",
    ],
    [
      "courts",
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_COUNT,
      summary.courtCount,
      "count",
    ],
    [
      "availability_rate",
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE,
      summary.availabilityRate,
      "ratio",
    ],
    [
      "utilization_rate",
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_UTILIZATION_RATE,
      summary.utilizationRate,
      "ratio",
    ],
    [
      "bookings",
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_BOOKINGS_COUNT,
      summary.bookingCount,
      "count",
    ],
    [
      "clubs",
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_COUNT,
      summary.clubCount,
      "count",
    ],
    [
      "members",
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_MEMBERS_COUNT,
      summary.membershipCount,
      "count",
    ],
    [
      "downtime_minutes",
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_DOWNTIME_MINUTES,
      summary.downtimeMinutes,
      "duration_seconds",
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

  const courtStatus = distributionToCategories(
    summary.courtStatusDistribution || {}
  );
  const courtStatusBreakdown = createAnalyticsBreakdownPayload({
    metricId: VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_STATUS_DISTRIBUTION,
    metricVersion: "1.0.0",
    dimension: "courtStatus",
    categories: courtStatus.categories,
    values: courtStatus.values,
    provenance,
    dataState,
  });
  if (!courtStatusBreakdown.ok) return courtStatusBreakdown;

  const membership = distributionToCategories(
    summary.membershipStatusDistribution || {}
  );
  const membershipBreakdown = createAnalyticsBreakdownPayload({
    metricId:
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_MEMBERS_STATUS_DISTRIBUTION,
    metricVersion: "1.0.0",
    dimension: "membershipStatus",
    categories: membership.categories,
    values: membership.values,
    provenance,
    dataState,
  });
  if (!membershipBreakdown.ok) return membershipBreakdown;

  const roles = distributionToCategories(summary.roleDistribution || {});
  const roleBreakdown = createAnalyticsBreakdownPayload({
    metricId: VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_ROLES_DISTRIBUTION,
    metricVersion: "1.0.0",
    dimension: "roleId",
    categories: roles.categories,
    values: roles.values,
    provenance,
    dataState,
  });
  if (!roleBreakdown.ok) return roleBreakdown;

  const bookingStatus = distributionToCategories(
    summary.bookingStatusDistribution || {}
  );
  const bookingTable = createAnalyticsTablePayload({
    columns: [
      { columnId: "status", label: "Booking status" },
      { columnId: "count", label: "Count" },
    ],
    rows: bookingStatus.categories.map((status, index) => ({
      rowId: `booking-${index}-${status}`,
      cells: { status, count: bookingStatus.values[index] },
    })),
    dataState,
    provenance,
  });
  if (!bookingTable.ok) return bookingTable;

  /** @type {unknown | undefined} */
  let timeSeries;
  if (options.historicalSeries && isPlainObject(options.historicalSeries)) {
    const seriesResult = createAnalyticsTimeSeriesPayload({
      metricId:
        options.historicalSeries.metricId ||
        VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_MEMBERS_COUNT,
      metricVersion: options.historicalSeries.metricVersion || "1.0.0",
      seriesId:
        options.historicalSeries.seriesId || "club-membership-growth",
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
      courtStatusBreakdown: courtStatusBreakdown.value,
      membershipBreakdown: membershipBreakdown.value,
      roleBreakdown: roleBreakdown.value,
      bookingStatusTable: bookingTable.value,
      ...(timeSeries ? { membershipTimeSeries: timeSeries } : {}),
      dataState,
      analyticalMethodVersion: VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.DASHBOARD,
      isCanonicalVenueCourtClubState: false,
    })
  );
}
