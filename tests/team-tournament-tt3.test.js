import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LINEUP_STATUS,
  MATCHUP_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  OVERRIDE_BLOCK_CODES,
  buildOverrideCommandVersions,
  canCaptainEditAfterOverride,
  isLineupVisibilityBlockedForOpponent,
  isRefereeLineupBlocked,
  isRepublishPending,
  resolveCanOverrideFromServer,
  resolveLineupDisplayStatus,
  resolveOverrideReadiness,
  validateOverrideReason,
} from "../src/features/team-tournament/engines/overrideLineupWorkflowEngine.js";
import { resolvePublishReadiness } from "../src/features/team-tournament/engines/atomicPublishWorkflowEngine.js";
import {
  findLineupTransition,
  LINEUP_ACTION,
  EXTENDED_LINEUP_STATUS,
} from "../src/features/team-tournament/engines/lineupStateMachine.js";
import { createEmptyTeamData, lineupKey } from "../src/features/team-tournament/models/index.js";
import { prepareOverrideRpcCall } from "../src/features/team-tournament/services/teamTournamentRpcService.js";

function buildFixture() {
  const teamData = createEmptyTeamData({
    teams: [
      { id: "team-a", name: "A", playerIds: ["p1", "p2"] },
      { id: "team-b", name: "B", playerIds: ["p3", "p4"] },
    ],
    matchups: [
      {
        id: "m1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: MATCHUP_STATUS.LOCKED,
        version: 5,
      },
    ],
  });

  for (const teamId of ["team-a", "team-b"]) {
    teamData.lineups[lineupKey("m1", teamId)] = {
      matchupId: "m1",
      teamId,
      status: LINEUP_STATUS.LOCKED,
      selections: { d1: [teamId === "team-a" ? "p1" : "p3"] },
      version: 2,
    };
  }

  return teamData;
}

test("resolveCanOverrideFromServer respects server canOverride", () => {
  const allowed = resolveCanOverrideFromServer({ canOverride: true, lineupVersion: 2 });
  assert.equal(allowed.canOverride, true);
  const blocked = resolveCanOverrideFromServer({
    canOverride: false,
    blockCode: "override_forbidden",
    blockMessage: "Denied",
  });
  assert.equal(blocked.canOverride, false);
  assert.equal(blocked.blockCode, "override_forbidden");
});

test("resolveOverrideReadiness blocked when lineup missing", () => {
  const teamData = buildFixture();
  const matchup = teamData.matchups[0];
  const readiness = resolveOverrideReadiness({
    teamData,
    matchup,
    teamId: "team-x",
    lineupOps: null,
  });
  assert.equal(readiness.canOverride, false);
  assert.equal(readiness.blockCode, OVERRIDE_BLOCK_CODES.LINEUP_MISSING);
});

test("validateOverrideReason requires reason", () => {
  const missing = validateOverrideReason("");
  assert.equal(missing.ok, false);
  assert.equal(missing.code, OVERRIDE_BLOCK_CODES.REASON_REQUIRED);
  const ok = validateOverrideReason("Thay VĐV chấn thương");
  assert.equal(ok.ok, true);
});

test("validateOverrideReason elevated length", () => {
  const short = validateOverrideReason("ngắn", { elevatedReasonRequired: true });
  assert.equal(short.ok, false);
  assert.equal(short.code, OVERRIDE_BLOCK_CODES.ELEVATED_REASON_REQUIRED);
});

test("isRepublishPending from matchup or publishOps", () => {
  assert.equal(isRepublishPending({ requiresRepublish: true }), true);
  assert.equal(isRepublishPending({ publishOps: { requiresRepublish: true } }), true);
  assert.equal(isRepublishPending({}), false);
});

test("resolveLineupDisplayStatus for overridden lineup", () => {
  const display = resolveLineupDisplayStatus(
    { status: LINEUP_STATUS.OVERRIDDEN },
    { requiresRepublish: true }
  );
  assert.equal(display.label, "Đã thay đổi — chờ công bố lại");
  assert.equal(display.requiresRepublish, true);
});

test("canCaptainEditAfterOverride false when overridden", () => {
  assert.equal(canCaptainEditAfterOverride({ status: LINEUP_STATUS.OVERRIDDEN }), false);
  assert.equal(canCaptainEditAfterOverride({ status: LINEUP_STATUS.SUBMITTED }), true);
});

test("isRefereeLineupBlocked when republish pending", () => {
  assert.equal(isRefereeLineupBlocked({ requiresRepublish: true }), true);
  assert.equal(isRefereeLineupBlocked({}), false);
});

test("isLineupVisibilityBlockedForOpponent when republish pending", () => {
  assert.equal(isLineupVisibilityBlockedForOpponent({ requiresRepublish: true }), true);
});

test("lineup state transitions for override flow", () => {
  assert.ok(findLineupTransition(LINEUP_ACTION.OVERRIDE, LINEUP_STATUS.LOCKED));
  assert.ok(findLineupTransition(LINEUP_ACTION.PUBLISH, EXTENDED_LINEUP_STATUS.OVERRIDDEN));
});

test("resolvePublishReadiness allows republish when requiresRepublish", () => {
  const teamData = buildFixture();
  teamData.lineups[lineupKey("m1", "team-a")].status = LINEUP_STATUS.OVERRIDDEN;
  const readiness = resolvePublishReadiness({
    teamData,
    matchup: {
      ...teamData.matchups[0],
      requiresRepublish: true,
      canPublish: true,
    },
    policy: "random",
  });
  assert.equal(readiness.canPublish, true);
  assert.equal(readiness.requiresRepublish, true);
});

test("buildOverrideCommandVersions uses matchup and lineup version", () => {
  const versions = buildOverrideCommandVersions({
    matchup: { version: 9 },
    lineup: { version: 4 },
  });
  assert.deepEqual(versions, {
    expectedMatchupVersion: 9,
    expectedLineupVersion: 4,
  });
});

test("prepareOverrideRpcCall requires idempotency key", () => {
  const prepared = prepareOverrideRpcCall({
    tournamentId: "t1",
    matchupId: "m1",
    teamId: "team-a",
    selections: { d1: ["p1"] },
    reason: "test",
    expectedMatchupVersion: 1,
    expectedLineupVersion: 2,
    idempotencyKey: "key-1",
  });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.args.p_reason, "test");
});
