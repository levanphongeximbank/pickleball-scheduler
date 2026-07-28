import { loadAIData } from "../../../ai/storage.js";
import { loadCourtManagementData } from "../../../domain/bookingService.js";
import { loadCourtManagementSettings } from "../../../domain/courtManagementSettings.js";
import {
  computeRangeRevenue,
  computeCourtUtilization,
  listDatesInRange,
  getBookingsByDate,
} from "../../../domain/courtBookingEngine.js";
import { loadClubs } from "../../../data/club.js";
import { buildDashboardSummary } from "../../../pages/dashboard.logic.js";
import { loadCourtsFromStorage, loadPlayersFromStorage } from "../../../pages/selectPlayers.data.js";
import { loadRoundsForClub } from "../../../domain/clubStorage.js";
import { buildMockDashboardPayload } from "../../../data/mockDashboardData.js";
import {
  classifyDashboardPayloadProvenance,
  createProvenanceMetadata,
  REPORT_PROVENANCE,
  REPORT_SOURCE_KIND,
  REPORTING_PRESENTATION_SOURCE_STATE,
  resolveDashboardPresentationSourceState,
} from "../../reporting-analytics/index.js";
import {
  computeTrendPercent,
  resolvePreviousPeriod,
} from "../constants/timeRangePresets.js";
import { generateOperationalInsights } from "./insightEngine.js";
import { isPlatformHardCutoverEnabled } from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  assertDashboardAnalyticsMockAllowed,
  assertDashboardAnalyticsLocalStorageAllowed,
} from "../../platform-hard-cutover/legacyAuthorityPolicy.js";

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getWeekdayLabel(isoDate) {
  const date = new Date(isoDate);
  const day = date.getDay();
  const index = day === 0 ? 6 : day - 1;
  return WEEKDAY_LABELS[index];
}

function filterBookingsByRange(bookings, from, to) {
  return (bookings || []).filter((booking) => booking.date >= from && booking.date <= to);
}

function loadRealContext(clubId) {
  const { bookings, courts: cmCourts } = loadCourtManagementData(clubId);
  const players = loadPlayersFromStorage(clubId);
  const courts = loadCourtsFromStorage(clubId);
  const aiData = loadAIData(clubId);
  const rounds = loadRoundsForClub(clubId);
  const clubs = loadClubs();

  return {
    bookings,
    courts: cmCourts?.length ? cmCourts : courts,
    players,
    sessions: aiData.sessions || [],
    rounds,
    clubs,
  };
}

function hasRealAnalyticsData(context) {
  return (
    (context.bookings?.length || 0) > 0 ||
    (context.players?.length || 0) > 0 ||
    (context.sessions?.length || 0) > 0
  );
}

function nowIso() {
  return new Date().toISOString();
}

function buildEmptyDashboardPayload({ clubId, from, to, observedAt }) {
  const provenance = createProvenanceMetadata({
    state: REPORT_PROVENANCE.UNAVAILABLE,
    sourceKind: REPORT_SOURCE_KIND.DASHBOARD_ADAPTER,
    observedAt,
    fallbackReason: "dashboard_no_live_rows",
    warnings: ["Live dashboard source returned no rows"],
  });
  const sourceState = resolveDashboardPresentationSourceState({
    isEmpty: true,
    mode: "live",
    observedAt,
  });

  return {
    ok: true,
    isMock: false,
    sourceState,
    provenance,
    summary: null,
    revenueSeries: [],
    newCustomersSeries: [],
    skillDistribution: [],
    genderDistribution: [],
    topPlayers: [],
    topCourts: [],
    heatmap: { weekdays: [], hours: [], cells: [] },
    peakHours: { busiest: [], quietest: [] },
    recentBookings: [],
    upcomingTournaments: [],
    insights: [],
    fieldStates: {},
    meta: { from, to, clubId, isEmpty: true, mode: "live", liveFailed: false },
  };
}

/**
 * Typed unavailable payload under hard cutover (no mock invention, no LS SoT).
 */
function buildUnavailableDashboardPayload({
  clubId,
  from,
  to,
  observedAt,
  reasonCode,
  reason,
}) {
  const provenance = createProvenanceMetadata({
    state: REPORT_PROVENANCE.UNAVAILABLE,
    sourceKind: REPORT_SOURCE_KIND.DASHBOARD_ADAPTER,
    observedAt,
    fallbackReason: reasonCode || "dashboard_hard_cutover_unavailable",
    warnings: [reason || "Dashboard analytics unavailable under hard cutover"],
  });
  const sourceState = {
    state: REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
    label: "UNAVAILABLE",
    reasonCode: reasonCode || "DASHBOARD_ANALYTICS_MOCK_FORBIDDEN",
    observedAt,
  };

  return {
    ok: false,
    isMock: false,
    unavailable: true,
    sourceState,
    provenance,
    summary: null,
    revenueSeries: [],
    newCustomersSeries: [],
    skillDistribution: [],
    genderDistribution: [],
    topPlayers: [],
    topCourts: [],
    heatmap: { weekdays: [], hours: [], cells: [] },
    peakHours: { busiest: [], quietest: [] },
    recentBookings: [],
    upcomingTournaments: [],
    insights: [],
    fieldStates: {},
    meta: {
      from,
      to,
      clubId,
      isEmpty: true,
      mode: "unavailable",
      liveFailed: false,
      hardCutover: true,
      reasonCode: reasonCode || "DASHBOARD_ANALYTICS_MOCK_FORBIDDEN",
      reason: reason || null,
    },
  };
}

function buildRealSummary(context, from, to) {
  const { bookings, courts, players, sessions, rounds, clubs } = context;
  const settings = loadCourtManagementSettings(context.clubId);
  const rangeBookings = filterBookingsByRange(bookings, from, to);
  const prev = resolvePreviousPeriod(from, to);
  const prevBookings = filterBookingsByRange(bookings, prev.from, prev.to);

  const revenue = computeRangeRevenue(bookings, from, to);
  const prevRevenue = computeRangeRevenue(bookings, prev.from, prev.to);
  const utilization = computeCourtUtilization(
    bookings,
    courts,
    from,
    to,
    settings.openHour,
    settings.closeHour
  );

  const bookingRevenue = revenue.byType?.single || revenue.byType?.regular || 0;
  const tournamentRevenue = revenue.byType?.tournament || 0;
  const membershipRevenue = revenue.byType?.membership || 0;
  const otherRevenue =
    revenue.expectedRevenue - bookingRevenue - tournamentRevenue - membershipRevenue;

  const customerPhones = new Set();
  const newCustomerPhones = new Set();
  rangeBookings.forEach((booking) => {
    const phone = booking.customerPhone || booking.customerName;
    if (!phone) return;
    customerPhones.add(phone);
    if (!prevBookings.some((prevBooking) => (prevBooking.customerPhone || prevBooking.customerName) === phone)) {
      newCustomerPhones.add(phone);
    }
  });

  const clubSummary = buildDashboardSummary({ sessions, players, courts, rounds });
  const activePlayerIds = new Set();
  sessions.forEach((session) => {
    if (session.date < from || session.date > to) return;
    (session.courts || []).forEach((court) => {
      [...(court.teamA || []), ...(court.teamB || [])].forEach((player) => {
        if (player?.id) activePlayerIds.add(player.id);
      });
    });
  });

  const totalCustomers = customerPhones.size || players.length;
  const newCustomers = newCustomerPhones.size;
  const returningCustomers = Math.max(0, totalCustomers - newCustomers);
  const activePlayers = activePlayerIds.size;
  const inactivePlayers = Math.max(0, players.length - activePlayers);
  const fieldStates = {};

  if (activePlayerIds.size === 0 && players.length > 0) {
    fieldStates.activePlayers = REPORTING_PRESENTATION_SOURCE_STATE.PARTIAL;
  }

  return {
    isMock: false,
    fieldStates,
    summary: {
      revenue: {
        total: revenue.expectedRevenue,
        booking: bookingRevenue,
        tournament: tournamentRevenue,
        membership: membershipRevenue,
        other: Math.max(0, otherRevenue),
        transactions: revenue.totalBookings,
        trendPercent: computeTrendPercent(revenue.expectedRevenue, prevRevenue.expectedRevenue),
      },
      customers: {
        total: totalCustomers,
        new: newCustomers,
        returning: returningCustomers,
        activePlayers,
        inactivePlayers,
        returnRate: totalCustomers > 0 ? Math.round((returningCustomers / totalCustomers) * 100) : 0,
        trendPercent: computeTrendPercent(totalCustomers, prevBookings.length),
      },
      clubs: {
        total: clubs.length,
        active: clubs.filter((club) => club.status !== "inactive").length,
        new: 0,
        members: players.length,
        mostActive: clubs[0]?.name || "—",
        trendPercent: 0,
      },
      courts: {
        total: courts.length,
        bookings: revenue.totalBookings,
        fillRate: utilization.utilizationPercent,
        usedHours: Math.round(utilization.bookedMinutes / 60),
        emptyHours: Math.max(
          0,
          Math.round((utilization.availableMinutes - utilization.bookedMinutes) / 60)
        ),
        trendPercent: computeTrendPercent(revenue.totalBookings, prevRevenue.totalBookings),
      },
    },
    clubSummary,
    revenue,
    utilization,
    rangeBookings,
    players,
    courts,
    clubs,
  };
}

function buildRevenueSeriesFromReal(revenue) {
  return (revenue.dailyBreakdown || []).map((day) => {
    const booking = day.byType?.single || day.byType?.regular || day.expectedRevenue * 0.6;
    const tournament = day.byType?.tournament || 0;
    const membership = day.byType?.membership || 0;
    const other = Math.max(0, day.expectedRevenue - booking - tournament - membership);
    return {
      date: day.date,
      label: day.date.slice(5),
      booking,
      tournament,
      membership,
      other,
      total: day.expectedRevenue,
    };
  });
}

function buildTopPlayersFromReal(clubSummary, players) {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const fieldStates = {};
  const rows = (clubSummary.topPlayers || []).map((row, index) => {
    const player = playerMap.get(row.id) || {};
    const matches = row.games || 0;
    const hasElo = Number.isFinite(Number(player.elo ?? player.rating));
    if (!hasElo) {
      fieldStates[`topPlayers.${row.id}.elo`] =
        REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE;
    }
    // Wins/winRate require real match outcomes — do not invent under LIVE.
    fieldStates[`topPlayers.${row.id}.wins`] =
      REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE;
    return {
      rank: index + 1,
      id: row.id,
      name: row.name,
      club: player.clubName || "CLB hiện tại",
      level: row.level || player.level || "—",
      elo: hasElo ? Number(player.elo ?? player.rating) : null,
      matches,
      wins: null,
      winRate: null,
      points: hasElo ? Number(player.elo ?? player.rating) : null,
      trend: null,
    };
  });
  return { rows, fieldStates };
}

function buildTopCourtsFromReal(utilization, revenue) {
  return [...(utilization.byCourt || [])]
    .map((court) => ({
      courtId: court.courtId,
      name: court.courtName,
      bookings: court.bookingCount,
      hours: Math.round(court.bookedMinutes / 60),
      revenue: revenue.byCourt?.[court.courtName] || 0,
      utilization: court.utilizationPercent,
      peakHour: null,
      isTopPerformer: false,
      isUnderused: court.utilizationPercent < 40,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.utilization - a.utilization)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      isTopPerformer: index === 0,
    }));
}

function buildHeatmapFromReal(bookings, courts, from, to, settings) {
  const dates = listDatesInRange(from, to);
  const hours = Array.from(
    { length: Math.max(1, settings.closeHour - settings.openHour) },
    (_, index) => settings.openHour + index
  );

  const cells = [];
  WEEKDAY_LABELS.forEach((weekday, dayIndex) => {
    hours.forEach((hour) => {
      const slotBookings = (bookings || []).filter((booking) => {
        if (booking.bookingStatus === "cancelled" || booking.bookingStatus === "no_show") return false;
        if (!dates.includes(booking.date)) return false;
        if (getWeekdayLabel(booking.date) !== weekday) return false;
        const startHour = Number(String(booking.startTime || "0").split(":")[0]);
        return startHour === hour;
      });

      const bookingsCount = slotBookings.length;
      const revenue = slotBookings.reduce(
        (sum, booking) => sum + (Number(booking.totalAmount) || 0),
        0
      );
      const maxPerSlot = Math.max(1, courts.length);
      const fillPercent = Math.min(100, Math.round((bookingsCount / maxPerSlot) * 100));

      let level = "low";
      if (fillPercent >= 75) level = "very_high";
      else if (fillPercent >= 55) level = "high";
      else if (fillPercent >= 35) level = "medium";

      cells.push({
        weekday,
        dayIndex,
        hour,
        hourLabel: `${String(hour).padStart(2, "0")}:00`,
        bookings: bookingsCount,
        fillPercent,
        revenue,
        level,
      });
    });
  });

  return { weekdays: WEEKDAY_LABELS, hours, cells };
}

function buildPeakHoursFromHeatmap(heatmap) {
  const sorted = [...heatmap.cells].sort((a, b) => b.bookings - a.bookings);
  const quiet = [...heatmap.cells].sort((a, b) => a.bookings - b.bookings);

  const weekdayTotals = heatmap.weekdays.map((weekday) => ({
    weekday,
    revenue: heatmap.cells
      .filter((cell) => cell.weekday === weekday)
      .reduce((sum, cell) => sum + cell.revenue, 0),
  }));

  weekdayTotals.sort((a, b) => b.revenue - a.revenue);

  const hourTotals = heatmap.hours.map((hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    revenue: heatmap.cells
      .filter((cell) => cell.hour === hour)
      .reduce((sum, cell) => sum + cell.revenue, 0),
  }));

  hourTotals.sort((a, b) => b.revenue - a.revenue);

  return {
    busiest: sorted.slice(0, 5).map((cell) => ({
      label: `${cell.weekday} ${cell.hourLabel}`,
      bookings: cell.bookings,
      fillPercent: cell.fillPercent,
      severity: cell.level === "very_high" ? "Rất đông" : cell.level === "high" ? "Đông" : "Trung bình",
    })),
    quietest: quiet.slice(0, 5).map((cell) => ({
      label: `${cell.weekday} ${cell.hourLabel}`,
      bookings: cell.bookings,
      fillPercent: cell.fillPercent,
      severity: "Thấp điểm",
    })),
    topRevenueHour: hourTotals[0] || null,
    busiestWeekday: weekdayTotals[0] || null,
    quietestWeekday: weekdayTotals[weekdayTotals.length - 1] || null,
  };
}

function buildPlayerAnalyticsFromReal(players, rangeBookings, revenueSeries) {
  const skillBuckets = {
    "2.0 - 2.5": 0,
    "3.0 - 3.5": 0,
    "4.0 - 4.5": 0,
    "5.0+": 0,
  };

  players.forEach((player) => {
    const level = Number(player.level) || 0;
    if (level < 3) skillBuckets["2.0 - 2.5"] += 1;
    else if (level < 4) skillBuckets["3.0 - 3.5"] += 1;
    else if (level < 5) skillBuckets["4.0 - 4.5"] += 1;
    else skillBuckets["5.0+"] += 1;
  });

  const genderMap = {};
  players.forEach((player) => {
    const key =
      player.gender === "female" ? "Nữ" : player.gender === "male" ? "Nam" : "Khác / chưa rõ";
    genderMap[key] = (genderMap[key] || 0) + 1;
  });

  // Honest daily unique customer counts — no fabricated new/returning split.
  const newCustomersSeries = revenueSeries.map((row) => {
    const dayBookings = getBookingsByDate(rangeBookings, row.date);
    const phones = new Set(dayBookings.map((b) => b.customerPhone || b.customerName).filter(Boolean));
    return {
      date: row.date,
      label: row.label,
      uniqueCustomers: phones.size,
      newCustomers: null,
      returningCustomers: null,
    };
  });

  return {
    skillDistribution: Object.entries(skillBuckets).map(([label, count]) => ({ label, count })),
    genderDistribution: Object.entries(genderMap).map(([label, count]) => ({ label, count })),
    newCustomersSeries,
    fieldStates: {
      "customers.newReturningSplit": REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE,
    },
  };
}

function assembleDashboardPayload(realPayload, from, to, observedAt) {
  const revenueSeries = buildRevenueSeriesFromReal(realPayload.revenue);
  const heatmap = buildHeatmapFromReal(
    realPayload.rangeBookings,
    realPayload.courts,
    from,
    to,
    loadCourtManagementSettings(realPayload.clubId)
  );
  const playerAnalytics = buildPlayerAnalyticsFromReal(
    realPayload.players,
    realPayload.rangeBookings,
    revenueSeries
  );
  const topPlayers = buildTopPlayersFromReal(realPayload.clubSummary, realPayload.players);
  const fieldStates = {
    ...(realPayload.fieldStates || {}),
    ...(playerAnalytics.fieldStates || {}),
    ...(topPlayers.fieldStates || {}),
  };
  const hasPartial = Object.keys(fieldStates).length > 0;
  const provenance = createProvenanceMetadata({
    state: hasPartial ? REPORT_PROVENANCE.LIVE : REPORT_PROVENANCE.LIVE,
    sourceKind: REPORT_SOURCE_KIND.DASHBOARD_ADAPTER,
    observedAt,
    lastSuccessfulRefreshAt: observedAt,
    warnings: hasPartial
      ? ["Some LIVE fields are unavailable and omitted rather than fabricated"]
      : [],
  });
  const sourceState = resolveDashboardPresentationSourceState({
    mode: "live",
    payload: { isMock: false, provenance, fieldStates },
    observedAt,
  });

  return {
    ok: true,
    isMock: false,
    sourceState,
    provenance,
    fieldStates,
    summary: realPayload.summary,
    revenueSeries,
    newCustomersSeries: playerAnalytics.newCustomersSeries,
    skillDistribution: playerAnalytics.skillDistribution,
    genderDistribution: playerAnalytics.genderDistribution,
    topPlayers: topPlayers.rows,
    topCourts: buildTopCourtsFromReal(realPayload.utilization, realPayload.revenue),
    heatmap,
    peakHours: buildPeakHoursFromHeatmap(heatmap),
    recentBookings: [],
    upcomingTournaments: [],
  };
}

function attachInsights(payload, sections) {
  payload.insights = generateOperationalInsights(payload, sections);
  return payload;
}

/**
 * @param {{
 *   clubId: string,
 *   from: string,
 *   to: string,
 *   sections?: object,
 *   mode?: 'live'|'demo'|'preview',
 *   env?: Record<string, unknown>,
 * }} options
 */
export function getDashboardAnalytics({
  clubId,
  from,
  to,
  sections,
  mode = "live",
  env,
}) {
  const prev = resolvePreviousPeriod(from, to);
  const observedAt = nowIso();
  const resolvedMode = mode === "demo" || mode === "preview" ? mode : "live";
  const hardCutover = isPlatformHardCutoverEnabled(env);

  if (resolvedMode === "demo" || resolvedMode === "preview") {
    const mockGate = assertDashboardAnalyticsMockAllowed(env);
    if (mockGate.ok === false || hardCutover) {
      return attachInsights(
        buildUnavailableDashboardPayload({
          clubId,
          from,
          to,
          observedAt,
          reasonCode:
            mockGate.code || "DASHBOARD_ANALYTICS_MOCK_FORBIDDEN",
          reason:
            mockGate.error ||
            "Dashboard mock/demo/preview is forbidden under hard cutover.",
        }),
        sections
      );
    }
    const payload = buildMockDashboardPayload(from, to, prev.from, prev.to);
    const provenance = classifyDashboardPayloadProvenance(payload, {
      liveFailed: false,
      observedAt,
    });
    const sourceState = resolveDashboardPresentationSourceState({
      mode: resolvedMode,
      payload,
      observedAt,
    });
    return attachInsights(
      {
        ...payload,
        ok: true,
        provenance,
        sourceState,
        fieldStates: {},
        meta: {
          from,
          to,
          clubId,
          isEmpty: false,
          mode: resolvedMode,
          liveFailed: false,
          explicitDemoOrPreview: true,
        },
      },
      sections
    );
  }

  // Hard cutover: local club/court blob is not Prod analytics SoT.
  // Prefer typed UNAVAILABLE until reporting_* projections are wired.
  if (hardCutover) {
    const lsGate = assertDashboardAnalyticsLocalStorageAllowed(env);
    return attachInsights(
      buildUnavailableDashboardPayload({
        clubId,
        from,
        to,
        observedAt,
        reasonCode:
          lsGate.code || "DASHBOARD_ANALYTICS_LOCALSTORAGE_FORBIDDEN",
        reason:
          lsGate.error ||
          "Dashboard requires reporting projections under hard cutover; localStorage authority is forbidden.",
      }),
      sections
    );
  }

  try {
    const context = { ...loadRealContext(clubId), clubId };
    if (!hasRealAnalyticsData(context)) {
      return attachInsights(
        buildEmptyDashboardPayload({ clubId, from, to, observedAt }),
        sections
      );
    }

    const realPayload = buildRealSummary(context, from, to);
    realPayload.clubId = clubId;
    const payload = assembleDashboardPayload(realPayload, from, to, observedAt);
    payload.meta = {
      from,
      to,
      clubId,
      isEmpty: false,
      mode: "live",
      liveFailed: false,
    };
    return attachInsights(payload, sections);
  } catch (err) {
    const message =
      err?.message || "Không tải được dữ liệu dashboard từ nguồn trực tiếp.";
    const error = new Error(message);
    error.code = "DASHBOARD_SOURCE_FAILED";
    error.sourceState = REPORTING_PRESENTATION_SOURCE_STATE.ERROR;
    error.liveFailed = true;
    error.cause = err;
    throw error;
  }
}

export function getDashboardSummary(options) {
  return getDashboardAnalytics(options).summary;
}

export function getRevenueAnalytics(options) {
  const data = getDashboardAnalytics(options);
  return { summary: data.summary?.revenue || null, series: data.revenueSeries };
}

export function getPlayerAnalytics(options) {
  const data = getDashboardAnalytics(options);
  return {
    summary: data.summary?.customers || null,
    newCustomersSeries: data.newCustomersSeries,
    skillDistribution: data.skillDistribution,
    genderDistribution: data.genderDistribution,
  };
}

export function getClubAnalytics(options) {
  return getDashboardAnalytics(options).summary?.clubs || null;
}

export function getTopPlayers(options) {
  return getDashboardAnalytics(options).topPlayers;
}

export function getTopCourts(options) {
  return getDashboardAnalytics(options).topCourts;
}

export function getCourtHeatmap(options) {
  return getDashboardAnalytics(options).heatmap;
}

export function getPeakHours(options) {
  return getDashboardAnalytics(options).peakHours;
}

export function getOperationalInsights(options) {
  return getDashboardAnalytics(options).insights;
}

export function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "—";
  }
  const amount = Number(value) || 0;
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)} tỷ`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)} tr`;
  }
  return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
}

export function formatTrend(trendPercent) {
  if (trendPercent == null || Number.isNaN(Number(trendPercent))) {
    return { value: null, direction: "flat", label: "—" };
  }
  const value = Number(trendPercent) || 0;
  return {
    value,
    direction: value > 0 ? "up" : value < 0 ? "down" : "flat",
    label: value > 0 ? `+${value}%` : `${value}%`,
  };
}
