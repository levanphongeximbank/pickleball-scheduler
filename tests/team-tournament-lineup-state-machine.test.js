import test from "node:test";
import assert from "node:assert/strict";

import { LINEUP_STATUS, MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";
import {
  LINEUP_ACTION,
  LINEUP_ACTOR_ROLE,
  EXTENDED_LINEUP_STATUS,
  assertLineupTransitionAllowed,
  canCaptainEditLineupStatus,
  evaluateLineupDeadline,
  findLineupTransition,
  listAllowedActions,
  normalizeLineupStatus,
} from "../src/features/team-tournament/engines/lineupStateMachine.js";

const futureLock = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const pastLock = new Date(Date.now() - 60 * 1000).toISOString();

test("normalizeLineupStatus maps not_started alias", () => {
  assert.equal(normalizeLineupStatus("not_started"), LINEUP_STATUS.NOT_SUBMITTED);
  assert.equal(normalizeLineupStatus("draft"), LINEUP_STATUS.DRAFT);
});

test("captain can save draft from submitted before deadline", () => {
  const result = assertLineupTransitionAllowed({
    action: LINEUP_ACTION.SAVE_DRAFT,
    fromStatus: LINEUP_STATUS.SUBMITTED,
    actorRole: LINEUP_ACTOR_ROLE.CAPTAIN,
    matchup: { lineupLockAt: futureLock, status: MATCHUP_STATUS.LINEUP_OPEN },
    serverNow: new Date().toISOString(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.toStatus, LINEUP_STATUS.DRAFT);
});

test("captain cannot save draft after deadline (server time)", () => {
  const result = assertLineupTransitionAllowed({
    action: LINEUP_ACTION.SAVE_DRAFT,
    fromStatus: LINEUP_STATUS.DRAFT,
    actorRole: LINEUP_ACTOR_ROLE.CAPTAIN,
    matchup: { lineupLockAt: pastLock, status: MATCHUP_STATUS.LINEUP_OPEN },
    serverNow: new Date().toISOString(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DEADLINE_PASSED");
});

test("captain cannot edit after locked", () => {
  const result = assertLineupTransitionAllowed({
    action: LINEUP_ACTION.SUBMIT,
    fromStatus: LINEUP_STATUS.LOCKED,
    actorRole: LINEUP_ACTOR_ROLE.CAPTAIN,
    matchup: { lineupLockAt: futureLock, status: MATCHUP_STATUS.LOCKED },
    lineup: { status: LINEUP_STATUS.LOCKED, lockedAt: new Date().toISOString() },
    serverNow: new Date().toISOString(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "LOCKED");
});

test("publish requires matchup locked", () => {
  const blocked = assertLineupTransitionAllowed({
    action: LINEUP_ACTION.PUBLISH,
    fromStatus: LINEUP_STATUS.LOCKED,
    actorRole: LINEUP_ACTOR_ROLE.BTC,
    matchup: { status: MATCHUP_STATUS.LINEUP_OPEN },
    serverNow: new Date().toISOString(),
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "MATCHUP_NOT_LOCKED");

  const allowed = assertLineupTransitionAllowed({
    action: LINEUP_ACTION.PUBLISH,
    fromStatus: LINEUP_STATUS.LOCKED,
    actorRole: LINEUP_ACTOR_ROLE.BTC,
    matchup: { status: MATCHUP_STATUS.LOCKED },
    serverNow: new Date().toISOString(),
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.toStatus, LINEUP_STATUS.PUBLISHED);
});

test("player role cannot submit", () => {
  const result = assertLineupTransitionAllowed({
    action: LINEUP_ACTION.SUBMIT,
    fromStatus: LINEUP_STATUS.DRAFT,
    actorRole: LINEUP_ACTOR_ROLE.PLAYER,
    matchup: { lineupLockAt: futureLock },
    serverNow: new Date().toISOString(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN");
});

test("deadline evaluation at exact lock moment is past deadline", () => {
  const lockAt = "2026-07-12T10:00:00.000Z";
  const evalAt = evaluateLineupDeadline({
    action: LINEUP_ACTION.SUBMIT,
    matchup: { lineupLockAt: lockAt },
    serverNow: lockAt,
  });
  assert.equal(evalAt.isPastDeadline, true);
  assert.equal(evalAt.ok, false);
  assert.equal(evalAt.canSubmit, false);
});

test("listAllowedActions for captain before deadline", () => {
  const actions = listAllowedActions({
    fromStatus: LINEUP_STATUS.DRAFT,
    actorRole: LINEUP_ACTOR_ROLE.CAPTAIN,
    matchup: { lineupLockAt: futureLock, status: MATCHUP_STATUS.LINEUP_OPEN },
    serverNow: new Date().toISOString(),
  });
  assert.ok(actions.includes(LINEUP_ACTION.SAVE_DRAFT));
  assert.ok(actions.includes(LINEUP_ACTION.SUBMIT));
  assert.ok(!actions.includes(LINEUP_ACTION.PUBLISH));
});

test("findLineupTransition returns audit action", () => {
  const row = findLineupTransition(LINEUP_ACTION.LOCK, LINEUP_STATUS.SUBMITTED);
  assert.ok(row);
  assert.equal(row.to, LINEUP_STATUS.LOCKED);
  assert.equal(row.auditAction, "team.lineup.lock");
});

test("canCaptainEditLineupStatus", () => {
  assert.equal(canCaptainEditLineupStatus(LINEUP_STATUS.SUBMITTED), true);
  assert.equal(canCaptainEditLineupStatus(LINEUP_STATUS.LOCKED), false);
  assert.equal(canCaptainEditLineupStatus(EXTENDED_LINEUP_STATUS.WITHDRAWN), false);
});
