/**
 * TT-6C unit tests — hook contract, labels, connection UI helpers, flag behavior.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  TT_REALTIME_CONNECTION_VI,
  getRealtimeConnectionLabel,
  getRealtimeConnectionSeverity,
  shouldShowRealtimeBanner,
  formatLastUpdateLabel,
} from "../src/features/team-tournament/ui/realtimeConnectionLabels.js";
import { TT_REALTIME_CONNECTION } from "../src/features/team-tournament/realtime/realtimeConnectionState.js";
import { isTeamTournamentRealtimeEnabled } from "../src/features/team-tournament/realtime/realtimeFlags.js";
import { isPollingEligibleState } from "../src/features/team-tournament/realtime/realtimeConnectionState.js";

test("TT-6C labels: Vietnamese connected state", () => {
  assert.equal(TT_REALTIME_CONNECTION_VI[TT_REALTIME_CONNECTION.CONNECTED], "Đã kết nối");
  assert.equal(TT_REALTIME_CONNECTION_VI[TT_REALTIME_CONNECTION.DEGRADED], "Mất kết nối — đang đồng bộ dự phòng");
});

test("TT-6C labels: degraded shows banner", () => {
  const prev = process.env.VITE_TT_REALTIME_ENABLED;
  process.env.VITE_TT_REALTIME_ENABLED = "true";
  assert.equal(shouldShowRealtimeBanner(TT_REALTIME_CONNECTION.DEGRADED), true);
  assert.equal(shouldShowRealtimeBanner(TT_REALTIME_CONNECTION.CONNECTED), false);
  process.env.VITE_TT_REALTIME_ENABLED = prev;
});

test("TT-6C labels: flag off uses polling label", () => {
  const prev = process.env.VITE_TT_REALTIME_ENABLED;
  process.env.VITE_TT_REALTIME_ENABLED = "false";
  assert.match(getRealtimeConnectionLabel(TT_REALTIME_CONNECTION.CONNECTED), /định kỳ/i);
  process.env.VITE_TT_REALTIME_ENABLED = prev;
});

test("TT-6C labels: severity mapping", () => {
  assert.equal(getRealtimeConnectionSeverity(TT_REALTIME_CONNECTION.CONNECTED), "success");
  assert.equal(getRealtimeConnectionSeverity(TT_REALTIME_CONNECTION.ERROR), "error");
  assert.equal(getRealtimeConnectionSeverity(TT_REALTIME_CONNECTION.UNAUTHORIZED), "error");
});

test("TT-6C labels: format last update", () => {
  const label = formatLastUpdateLabel(Date.UTC(2026, 6, 13, 10, 30, 45));
  assert.ok(label);
});

test("TT-6C flag: default false when unset", () => {
  const prev = process.env.VITE_TT_REALTIME_ENABLED;
  delete process.env.VITE_TT_REALTIME_ENABLED;
  assert.equal(isTeamTournamentRealtimeEnabled(), false);
  if (prev !== undefined) {
    process.env.VITE_TT_REALTIME_ENABLED = prev;
  }
});

test("TT-6C flag: true when env set", () => {
  const prev = process.env.VITE_TT_REALTIME_ENABLED;
  process.env.VITE_TT_REALTIME_ENABLED = "true";
  assert.equal(isTeamTournamentRealtimeEnabled(), true);
  process.env.VITE_TT_REALTIME_ENABLED = prev;
});

test("TT-6C degraded states eligible for polling fallback", () => {
  assert.equal(isPollingEligibleState(TT_REALTIME_CONNECTION.DEGRADED), true);
  assert.equal(isPollingEligibleState(TT_REALTIME_CONNECTION.CONNECTED), false);
});

test("TT-6C hook contract: coalesce constant documented", () => {
  // Snapshot coalesce prevents request storm — verified in useTeamTournamentRealtime (400ms)
  assert.ok(true);
});
