import test from "node:test";
import assert from "node:assert/strict";

import {
  configureRealtimeObservabilityDebug,
  createRealtimeObservability,
  isTeamTournamentRealtimeDebugEnabled,
  isTeamTournamentRealtimeEnabled,
  __resetTeamTournamentRealtimeObservabilityForTests,
} from "../src/features/team-tournament/realtime/index.js";
import { getTeamTournamentRealtimeService, __resetTeamTournamentRealtimeServiceForTests } from "../src/features/team-tournament/realtime/TeamTournamentRealtimeService.js";

test.beforeEach(() => {
  delete process.env.VITE_TT_REALTIME_ENABLED;
  delete process.env.VITE_TT_REALTIME_DEBUG;
  __resetTeamTournamentRealtimeObservabilityForTests();
  __resetTeamTournamentRealtimeServiceForTests();
});

test("TT-6D debug flag: default false when unset", () => {
  assert.equal(isTeamTournamentRealtimeDebugEnabled(), false);
});

test("TT-6D debug flag: true when env set", () => {
  process.env.VITE_TT_REALTIME_DEBUG = "true";
  assert.equal(isTeamTournamentRealtimeDebugEnabled(), true);
});

test("TT-6D realtime master flag remains default false", () => {
  assert.equal(isTeamTournamentRealtimeEnabled(), false);
});

test("TT-6D observability log redacts sensitive fields", () => {
  const obs = createRealtimeObservability();
  const entries = [];
  obs.setLogger((entry) => entries.push(entry));
  obs.log("event_discarded", {
    tournamentId: "phase23d-probe-tournament",
    payload: { secret: "should-not-appear" },
    jwt: "token",
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].payload, undefined);
  assert.equal(entries[0].jwt, undefined);
  assert.equal(entries[0].tournamentId, "phase23d-probe-tournament");
});

test("TT-6D configureRealtimeObservabilityDebug wires logger when debug flag on", () => {
  process.env.VITE_TT_REALTIME_DEBUG = "true";
  const obs = createRealtimeObservability();
  configureRealtimeObservabilityDebug(obs);
  assert.doesNotThrow(() => obs.log("connect", { tournamentId: "t1" }));
});

test("TT-6D observability snapshot tracks latency average", () => {
  const obs = createRealtimeObservability();
  obs.recordLatency(10);
  obs.recordLatency(30);
  const snap = obs.snapshot();
  assert.equal(snap.event_to_snapshot_latency_ms_count, 2);
  assert.equal(snap.event_to_snapshot_latency_ms_avg, 20);
});

test("TT-6D service exposes shared observability snapshot", () => {
  const svc = getTeamTournamentRealtimeService();
  const obs = svc.getObservability?.();
  assert.ok(obs);
  assert.equal(typeof obs.snapshot, "function");
  obs.increment("subscriptions_started");
  assert.equal(obs.snapshot().subscriptions_started, 1);
});
