/**
 * Wave 2 Batch 2E — representative pilot adoption contracts (node-safe).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const PLAYERS = "src/pages/Players.jsx";
const DASHBOARD =
  "src/features/dashboard-analytics/components/DashboardAnalyticsView.jsx";
const AUDIT = "src/pages/AuditLogPage.jsx";
const COURTS = "src/pages/Courts.jsx";

test("batch2e pilots exist", () => {
  for (const rel of [PLAYERS, DASHBOARD, AUDIT, COURTS]) {
    assert.equal(existsSync(path.join(root, rel)), true, rel);
  }
});

test("batch2e Players — Tournament UI leak removed; Auth patterns adopted", () => {
  const src = read(PLAYERS);
  assert.equal(/^import\s+.*TournamentPageHeader/m.test(src), false);
  assert.equal(/^import\s+.*TournamentEmptyState/m.test(src), false);
  assert.equal(/TOURNAMENT_LAYOUT/.test(src), false);
  assert.equal(/from\s+["'].*web-app-ui/.test(src), true);
  assert.equal(src.includes("AuthPageHeader"), true);
  assert.equal(src.includes("AuthEmptyState"), true);
  assert.equal(src.includes("AuthFilterBar"), true);
  assert.equal(src.includes("AuthLoadingState"), true);
  assert.equal(src.includes("AuthConfirmDialog"), true);
  assert.equal(src.includes('confirmTone="destructive"'), true);
});

test("batch2e Dashboard — Auth header/states/filter; domain KPIs preserved", () => {
  const src = read(DASHBOARD);
  assert.equal(src.includes("AuthPageHeader"), true);
  assert.equal(src.includes("AuthFilterBar"), true);
  assert.equal(src.includes("AuthLoadingState"), true);
  assert.equal(src.includes("AuthErrorState"), true);
  assert.equal(src.includes("AuthEmptyState"), true);
  assert.equal(src.includes("function StackHeader"), false);
  assert.equal(src.includes("DashboardLoadingState"), false);
  assert.equal(src.includes("DashboardOverviewKpis"), true);
  assert.equal(src.includes("RevenueChart"), true);
});

test("batch2e Audit — Auth data view closes dense nowrap; snackbar pilot", () => {
  const src = read(AUDIT);
  assert.equal(src.includes("AuthPageHeader"), true);
  assert.equal(src.includes("AuthFilterBar"), true);
  assert.equal(src.includes("AuthResponsiveDataView"), true);
  assert.equal(src.includes("AppSnackbar"), true);
  assert.equal(src.includes("StatusToneChip"), true);
  assert.equal(src.includes('whiteSpace: "nowrap"'), false);
  assert.equal(src.includes("@mui/x-data-grid"), false);
});

test("batch2e Courts — Auth header/empty; hierarchy copy preserved; no calendar matrix", () => {
  const src = read(COURTS);
  assert.equal(src.includes("AuthPageHeader"), true);
  assert.equal(src.includes("AuthEmptyState"), true);
  assert.equal(/cụm|cluster/i.test(src), true);
  assert.equal(src.includes("CourtCalendarWeekMatrix"), false);
});

test("batch2e freeze — pilots do not import Public / Experience / shell chrome", () => {
  for (const rel of [PLAYERS, DASHBOARD, AUDIT, COURTS]) {
    const src = read(rel);
    assert.equal(/^import\s+.*ExperiencePageHeader/m.test(src), false, rel);
    assert.equal(/^import\s+.*CanonicalTopBar/m.test(src), false, rel);
    assert.equal(/^import\s+.*CanonicalAppShell/m.test(src), false, rel);
    assert.equal(/from\s+["'].*publicPortalStyles/.test(src), false, rel);
  }
});

test("batch2e routes remain wired", () => {
  const router = read("src/router.jsx");
  assert.equal(router.includes('path="/dashboard"'), true);
  assert.equal(router.includes('path="/players"'), true);
  assert.equal(router.includes('path="/audit"'), true);
  assert.equal(router.includes('path="courts"'), true);
  assert.equal(router.includes("court-management"), true);
});
