import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShadowCompareReport,
  classifyReadFailure,
  extractDreambreakerRows,
} from "../scripts/lib/team-tournament-shadow-compare-report.mjs";

test("classifyReadFailure: RLS → authorization_error BLOCKED", () => {
  const r = classifyReadFailure({ code: "42501", message: "permission denied" });
  assert.equal(r.status, "BLOCKED");
  assert.equal(r.code, "authorization_error");
});

test("classifyReadFailure: generic → cloud_read_error ERROR", () => {
  const r = classifyReadFailure({ message: "timeout" });
  assert.equal(r.status, "ERROR");
  assert.equal(r.code, "cloud_read_error");
});

test("buildShadowCompareReport: identical snapshots → ok", () => {
  const td = {
    teams: [{ id: "t1", name: "A", playerIds: ["p1"] }],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
  };
  const r = buildShadowCompareReport(td, td);
  assert.equal(r.ok, true);
  assert.equal(r.mismatchCount, 0);
});

test("buildShadowCompareReport: empty cloud would mismatch if compared — script must not compare on ERROR", () => {
  const blob = {
    teams: [{ id: "t1", name: "A", playerIds: ["p1"] }],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
  };
  const r = buildShadowCompareReport(blob, {});
  assert.equal(r.ok, false);
  assert.ok(r.mismatches.some((m) => m.mismatchType === "missing_in_cloud"));
});

test("dreambreaker pilot detection", () => {
  const td = {
    teams: [],
    matchups: [{ id: "m1", dreambreaker: { status: "pending" }, subMatches: [] }],
    disciplines: [],
    lineups: {},
    standings: [],
  };
  assert.equal(extractDreambreakerRows(td).length, 1);
  const r = buildShadowCompareReport(td, { teams: [], matchups: [], disciplines: [], lineups: {}, standings: [] });
  assert.equal(r.dreambreakerPilot.pilotUsesDreambreaker, true);
});
