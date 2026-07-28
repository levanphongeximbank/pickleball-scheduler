import test from "node:test";
import assert from "node:assert/strict";

import { getDashboardAnalytics } from "../src/features/dashboard-analytics/services/dashboardService.js";
import {
  HARD_CUTOVER_FLAG,
  getRuntimeAuthorityEntry,
} from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
import { REPORTING_PRESENTATION_SOURCE_STATE } from "../src/features/reporting-analytics/index.js";

test("dashboard HC: matrix registers dashboard_analytics read-only", () => {
  const row = getRuntimeAuthorityEntry("dashboard_analytics");
  assert.ok(row);
  assert.equal(row.canonicalWriter, "none (read-only dashboard; no biz mutation)");
  assert.equal(row.failClosedError, "DASHBOARD_ANALYTICS_MOCK_FORBIDDEN");
});

test("dashboard HC: demo mode returns typed UNAVAILABLE — no mock invent", () => {
  const payload = getDashboardAnalytics({
    clubId: "club-hc",
    from: "2026-01-01",
    to: "2026-01-07",
    mode: "demo",
    env: { [HARD_CUTOVER_FLAG]: "true" },
  });
  assert.equal(payload.isMock, false);
  assert.equal(payload.unavailable, true);
  assert.equal(payload.ok, false);
  assert.equal(payload.meta.mode, "unavailable");
  assert.equal(payload.meta.reasonCode, "DASHBOARD_ANALYTICS_MOCK_FORBIDDEN");
  assert.equal(
    payload.sourceState.state,
    REPORTING_PRESENTATION_SOURCE_STATE.UNAVAILABLE
  );
  assert.equal(payload.summary, null);
});

test("dashboard HC: live mode forbids localStorage SoT — typed UNAVAILABLE", () => {
  const payload = getDashboardAnalytics({
    clubId: "club-hc",
    from: "2026-01-01",
    to: "2026-01-07",
    mode: "live",
    env: { [HARD_CUTOVER_FLAG]: "true" },
  });
  assert.equal(payload.unavailable, true);
  assert.equal(payload.isMock, false);
  assert.equal(
    payload.meta.reasonCode,
    "DASHBOARD_ANALYTICS_LOCALSTORAGE_FORBIDDEN"
  );
});

test("dashboard without HC: demo still builds mock payload", () => {
  const payload = getDashboardAnalytics({
    clubId: "club-open",
    from: "2026-01-01",
    to: "2026-01-07",
    mode: "demo",
    env: { [HARD_CUTOVER_FLAG]: "false" },
  });
  assert.equal(payload.meta.explicitDemoOrPreview, true);
  assert.notEqual(payload.meta.mode, "unavailable");
});
