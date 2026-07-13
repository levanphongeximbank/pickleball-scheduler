import test from "node:test";
import assert from "node:assert/strict";

import {
  REALTIME_CONNECTION,
  buildRefereeMatchChannelName,
  extractRealtimeNotification,
} from "../../src/features/referee-v5/constants/realtimeConnectionStates.js";
import {
  computeReconnectDelayMs,
  mapSubscriptionStatusToConnection,
  shouldDisableMutations,
  shouldEnablePolling,
  shouldReloadFromNotification,
} from "../../src/features/referee-v5/realtime/realtimeSyncLogic.js";

test("buildRefereeMatchChannelName scopes by matchId", () => {
  assert.equal(buildRefereeMatchChannelName("MATCH-1"), "referee-v5:match:MATCH-1");
});

test("extractRealtimeNotification reads version metadata only", () => {
  const note = extractRealtimeNotification({
    match_id: "m1",
    tenant_id: "t1",
    state_version: 5,
    last_event_sequence: 5,
    status: "in_progress",
    updated_at: "2026-07-13T00:00:00Z",
    state_payload: { teams: { teamA: { score: 99 } } },
  });
  assert.equal(note.stateVersion, 5);
  assert.equal(note.eventSequence, 5);
  assert.equal(note.matchId, "m1");
  assert.equal(note.tenantId, "t1");
  assert.equal("teams" in note, false);
});

test("shouldReloadFromNotification ignores duplicate and stale versions", () => {
  assert.deepEqual(
    shouldReloadFromNotification({ notificationVersion: 5, currentVersion: 5 }),
    { reload: false, reason: "stale_or_duplicate" },
  );
  assert.deepEqual(
    shouldReloadFromNotification({ notificationVersion: 4, currentVersion: 5 }),
    { reload: false, reason: "stale_or_duplicate" },
  );
});

test("shouldReloadFromNotification triggers on next version", () => {
  assert.deepEqual(
    shouldReloadFromNotification({ notificationVersion: 6, currentVersion: 5, isProcessing: false }),
    { reload: true, reason: "next_version" },
  );
});

test("shouldReloadFromNotification triggers full reload on version gap", () => {
  assert.deepEqual(
    shouldReloadFromNotification({ notificationVersion: 10, currentVersion: 5, isProcessing: false }),
    { reload: true, reason: "version_gap" },
  );
});

test("shouldReloadFromNotification skips while local mutation in progress", () => {
  assert.deepEqual(
    shouldReloadFromNotification({ notificationVersion: 6, currentVersion: 5, isProcessing: true }),
    { reload: false, reason: "local_mutation_in_progress" },
  );
});

test("mapSubscriptionStatusToConnection maps Supabase statuses", () => {
  assert.equal(mapSubscriptionStatusToConnection("SUBSCRIBED"), REALTIME_CONNECTION.CONNECTED);
  assert.equal(mapSubscriptionStatusToConnection("CLOSED"), REALTIME_CONNECTION.DISCONNECTED);
  assert.equal(mapSubscriptionStatusToConnection("CHANNEL_ERROR"), REALTIME_CONNECTION.ERROR);
});

test("shouldEnablePolling only when disconnected or error or reconnecting", () => {
  assert.equal(shouldEnablePolling(REALTIME_CONNECTION.SYNCED), false);
  assert.equal(shouldEnablePolling(REALTIME_CONNECTION.DISCONNECTED), true);
  assert.equal(shouldEnablePolling(REALTIME_CONNECTION.RECONNECTING), true);
});

test("shouldDisableMutations blocks when disconnected or connecting", () => {
  assert.equal(
    shouldDisableMutations({ realtimeConnectionState: REALTIME_CONNECTION.DISCONNECTED, loaded: true }),
    true,
  );
  assert.equal(
    shouldDisableMutations({ realtimeConnectionState: REALTIME_CONNECTION.SYNCED, loaded: true }),
    false,
  );
  assert.equal(
    shouldDisableMutations({ realtimeConnectionState: REALTIME_CONNECTION.SYNCED, loaded: true, remoteError: true }),
    true,
  );
});

test("computeReconnectDelayMs exponential backoff capped", () => {
  assert.equal(computeReconnectDelayMs(1), 1000);
  assert.equal(computeReconnectDelayMs(2), 2000);
  assert.ok(computeReconnectDelayMs(10) <= 30000);
});
