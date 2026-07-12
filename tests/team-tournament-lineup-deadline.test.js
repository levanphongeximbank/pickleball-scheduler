import test from "node:test";
import assert from "node:assert/strict";

import {
  DEADLINE_STATUS,
  createServerClockSync,
  getSyncedNowIso,
  getSyncedNowMs,
  isDeadlineElapsed,
  mapSetupDeadlineMeta,
  matchupNeedsLineupAction,
  resolveMatchupLineupPermissions,
} from "../src/features/team-tournament/services/lineupDeadlineService.js";
import { LINEUP_STATUS, MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";

const futureLock = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const pastLock = new Date(Date.now() - 60 * 1000).toISOString();

test("mapSetupDeadlineMeta extracts server deadline fields", () => {
  const meta = mapSetupDeadlineMeta({
    ok: true,
    serverTime: "2026-07-12T10:00:00.000Z",
    lineupDeadline: futureLock,
    canSaveDraft: true,
    canSubmit: true,
    deadlineStatus: DEADLINE_STATUS.BEFORE,
    viewerTeamId: "team-a",
  });

  assert.equal(meta.serverTime, "2026-07-12T10:00:00.000Z");
  assert.equal(meta.canSaveDraft, true);
  assert.equal(meta.canSubmit, true);
  assert.equal(meta.deadlineStatus, DEADLINE_STATUS.BEFORE);
  assert.equal(meta.source, "server");
});

test("server clock sync offsets client display without changing permissions source", () => {
  const serverTime = new Date("2026-07-12T10:00:00.000Z");
  const sync = createServerClockSync(serverTime.toISOString());
  assert.ok(sync);
  const synced = getSyncedNowMs(sync);
  assert.ok(Math.abs(synced - serverTime.getTime()) < 50);
  assert.equal(getSyncedNowIso(sync).slice(0, 19), "2026-07-12T10:00:00");
});

test("cloud primary uses server flags even when client clock is fast", () => {
  const fastServerNow = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const sync = createServerClockSync(fastServerNow);
  const permissions = resolveMatchupLineupPermissions({
    matchup: {
      lineupLockAt: futureLock,
      lineupDeadline: futureLock,
      canSaveDraft: false,
      canSubmit: false,
      deadlineStatus: DEADLINE_STATUS.PAST,
    },
    lineup: { status: LINEUP_STATUS.DRAFT },
    isCloudPrimary: true,
    serverClock: sync,
  });

  assert.equal(permissions.source, "server");
  assert.equal(permissions.canSaveDraft, false);
  assert.equal(permissions.canSubmit, false);
  assert.equal(permissions.deadlineStatus, DEADLINE_STATUS.PAST);
});

test("blob fallback allows save before deadline with synced server time", () => {
  const permissions = resolveMatchupLineupPermissions({
    matchup: { lineupLockAt: futureLock },
    lineup: { status: LINEUP_STATUS.DRAFT },
    isCloudPrimary: false,
    serverClock: createServerClockSync(new Date().toISOString()),
  });

  assert.equal(permissions.source, "blob");
  assert.equal(permissions.canSaveDraft, true);
  assert.equal(permissions.canSubmit, true);
});

test("blob fallback blocks after deadline", () => {
  const permissions = resolveMatchupLineupPermissions({
    matchup: { lineupLockAt: pastLock },
    lineup: { status: LINEUP_STATUS.DRAFT },
    isCloudPrimary: false,
    serverClock: createServerClockSync(new Date().toISOString()),
  });

  assert.equal(permissions.canSaveDraft, false);
  assert.equal(permissions.canSubmit, false);
  assert.equal(permissions.deadlineStatus, DEADLINE_STATUS.PAST);
});

test("at-deadline 1s window is blocked in blob fallback", () => {
  const lockAt = new Date(Date.now() - 500).toISOString();
  const permissions = resolveMatchupLineupPermissions({
    matchup: { lineupLockAt: lockAt },
    lineup: { status: LINEUP_STATUS.DRAFT },
    isCloudPrimary: false,
    serverClock: createServerClockSync(new Date().toISOString()),
  });

  assert.equal(permissions.deadlineStatus, DEADLINE_STATUS.AT);
  assert.equal(permissions.canSaveDraft, false);
  assert.equal(permissions.canSubmit, false);
});

test("locked lineup status yields locked deadlineStatus on blob fallback", () => {
  const permissions = resolveMatchupLineupPermissions({
    matchup: { lineupLockAt: futureLock, status: MATCHUP_STATUS.LOCKED },
    lineup: { status: LINEUP_STATUS.LOCKED, lockedAt: new Date().toISOString() },
    isCloudPrimary: false,
    serverClock: createServerClockSync(new Date().toISOString()),
  });

  assert.equal(permissions.deadlineStatus, DEADLINE_STATUS.LOCKED);
  assert.equal(permissions.canSaveDraft, false);
});

test("matchupNeedsLineupAction respects server denial", () => {
  assert.equal(
    matchupNeedsLineupAction({
      permissions: { canSaveDraft: false, canSubmit: false },
      lineupStatus: LINEUP_STATUS.DRAFT,
    }),
    false
  );
  assert.equal(
    matchupNeedsLineupAction({
      permissions: { canSaveDraft: true, canSubmit: true },
      lineupStatus: LINEUP_STATUS.DRAFT,
    }),
    true
  );
});

test("isDeadlineElapsed uses synced now for countdown expiry", () => {
  const deadline = new Date(Date.now() - 1000).toISOString();
  assert.equal(isDeadlineElapsed({ lineupDeadline: deadline, syncedNowMs: Date.now() }), true);
  assert.equal(
    isDeadlineElapsed({
      lineupDeadline: futureLock,
      syncedNowMs: Date.now(),
    }),
    false
  );
});

test("simulate SQL at-boundary: now >= lock and now < lock + 1s", () => {
  function sqlDeadlineStatus(nowMs, lockMs) {
    if (nowMs < lockMs) {
      return DEADLINE_STATUS.BEFORE;
    }
    if (nowMs >= lockMs && nowMs < lockMs + 1000) {
      return DEADLINE_STATUS.AT;
    }
    return DEADLINE_STATUS.PAST;
  }

  const lockMs = Date.parse("2026-07-12T12:00:00.000Z");
  assert.equal(sqlDeadlineStatus(lockMs - 1, lockMs), DEADLINE_STATUS.BEFORE);
  assert.equal(sqlDeadlineStatus(lockMs, lockMs), DEADLINE_STATUS.AT);
  assert.equal(sqlDeadlineStatus(lockMs + 999, lockMs), DEADLINE_STATUS.AT);
  assert.equal(sqlDeadlineStatus(lockMs + 1000, lockMs), DEADLINE_STATUS.PAST);
});
