import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveTimeRange,
  resolvePreviousPeriod,
  computeTrendPercent,
  TIME_RANGE_PRESETS,
} from "../src/features/dashboard-analytics/constants/timeRangePresets.js";
import { resolveDashboardAccess } from "../src/features/dashboard-analytics/services/dashboardScope.js";
import {
  getDashboardAnalytics,
  formatCurrency,
  formatTrend,
} from "../src/features/dashboard-analytics/services/dashboardService.js";
import { generateOperationalInsights } from "../src/features/dashboard-analytics/services/insightEngine.js";
import { buildMockDashboardPayload } from "../src/data/mockDashboardData.js";
import { ROLES } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";

test("resolveTimeRange returns expected 7-day window", () => {
  const range = resolveTimeRange(
    TIME_RANGE_PRESETS.LAST_7_DAYS,
    "",
    "",
    new Date("2026-06-28T12:00:00.000Z")
  );

  assert.equal(range.from, "2026-06-22");
  assert.equal(range.to, "2026-06-28");
});

test("resolvePreviousPeriod mirrors day count", () => {
  const prev = resolvePreviousPeriod("2026-06-22", "2026-06-28");
  assert.equal(prev.dayCount, 7);
  assert.equal(prev.to, "2026-06-21");
});

test("computeTrendPercent handles zero baseline", () => {
  assert.equal(computeTrendPercent(100, 0), 100);
  assert.equal(computeTrendPercent(0, 0), 0);
});

test("resolveDashboardAccess blocks player role", () => {
  const access = resolveDashboardAccess({ role: ROLES.PLAYER }, () => true, {});
  assert.equal(access.allowed, false);
});

test("resolveDashboardAccess limits cashier sections", () => {
  const can = (permission) =>
    [
      PERMISSIONS.COURT_VIEW,
      PERMISSIONS.BOOKING_VIEW,
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
    ].includes(permission);

  const access = resolveDashboardAccess({ role: ROLES.CASHIER }, can, {});
  assert.equal(access.allowed, true);
  assert.equal(access.sections.clubs, false);
  assert.equal(access.sections.topPlayers, false);
  assert.equal(access.sections.revenue, true);
});

test("resolveDashboardAccess scopes CLUB_OWNER alias to club data", () => {
  const can = (permission) =>
    [
      PERMISSIONS.CLUB_VIEW,
      PERMISSIONS.PLAYER_VIEW,
      PERMISSIONS.STATISTICS_VIEW,
      PERMISSIONS.TOURNAMENT_VIEW,
    ].includes(permission);

  const access = resolveDashboardAccess({ role: ROLES.CLUB_OWNER }, can, {});
  assert.equal(access.allowed, true);
  assert.equal(access.dataScope, "club");
  assert.equal(access.sections.courts, false);
  assert.equal(access.sections.heatmap, false);
  assert.equal(access.sections.peakHours, false);
});

test("buildMockDashboardPayload returns complete analytics shape", () => {
  const payload = buildMockDashboardPayload("2026-06-01", "2026-06-28", "2026-05-01", "2026-05-28");

  assert.equal(payload.isMock, true);
  assert.ok(payload.summary.revenue.total > 0);
  assert.ok(payload.revenueSeries.length > 0);
  assert.ok(payload.topPlayers.length > 0);
  assert.ok(payload.topCourts.length > 0);
  assert.ok(payload.heatmap.cells.length > 0);
  assert.ok(payload.peakHours.busiest.length > 0);
});

test("getDashboardAnalytics returns mock payload when no local data", () => {
  const payload = getDashboardAnalytics({
    clubId: "__test_empty_club__",
    from: "2026-06-01",
    to: "2026-06-28",
    sections: { revenue: true, courts: true, insights: true },
  });

  assert.equal(payload.isMock, true);
  assert.ok(Array.isArray(payload.insights));
  assert.ok(payload.summary.courts.total >= 0);
});

test("generateOperationalInsights produces rule-based tips", () => {
  const payload = buildMockDashboardPayload("2026-06-01", "2026-06-28", "2026-05-01", "2026-05-28");
  const insights = generateOperationalInsights(payload, {
    revenue: true,
    courts: true,
    peakHours: true,
    customers: true,
    clubs: true,
  });

  assert.ok(insights.length >= 3);
  assert.ok(insights.some((item) => item.text.includes("cao điểm") || item.text.includes("demo")));
});

test("formatCurrency and formatTrend helpers", () => {
  assert.match(formatCurrency(1_500_000), /1\.5 tr/);
  const trend = formatTrend(12);
  assert.equal(trend.direction, "up");
  assert.equal(trend.label, "+12%");
});
