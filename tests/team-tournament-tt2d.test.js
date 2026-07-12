import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LINEUP_SOURCE,
  LINEUP_STATUS,
  MATCHUP_STATUS,
  MISSING_LINEUP_POLICY,
} from "../src/features/team-tournament/constants.js";
import {
  normalizeMissingLineupPolicy,
  resolveMatchupMissingLineupState,
  isMissingLineupPolicyHandled,
  isDeadlinePassed,
} from "../src/features/team-tournament/engines/missingLineupPolicyEngine.js";
import { lockMatchupLineups } from "../src/features/team-tournament/engines/lineupEngine.js";
import { createEmptyTeamData, lineupKey } from "../src/features/team-tournament/models/index.js";
import { assertLineupTransitionAllowed, LINEUP_ACTION } from "../src/features/team-tournament/engines/lineupStateMachine.js";

function buildFixture({ policy = MISSING_LINEUP_POLICY.RANDOM, deadlineOffsetMs = -60000 } = {}) {
  const now = Date.now();
  const teamData = createEmptyTeamData({
    settings: { missingLineupPolicy: policy, allowPlayerReusePerMatchup: false },
    teams: [
      { id: "team-a", name: "Team A", playerIds: ["p1", "p2", "p3", "p4"] },
      { id: "team-b", name: "Team B", playerIds: ["p5", "p6", "p7", "p8"] },
    ],
    disciplines: [
      {
        id: "d1",
        name: "Doubles",
        genderRequirement: "any",
        playerCount: 2,
        sortOrder: 1,
      },
    ],
    matchups: [
      {
        id: "m1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: MATCHUP_STATUS.LINEUP_OPEN,
        lineupLockAt: new Date(now + deadlineOffsetMs).toISOString(),
      },
    ],
  });

  teamData.lineups[lineupKey("m1", "team-a")] = {
    matchupId: "m1",
    teamId: "team-a",
    status: LINEUP_STATUS.SUBMITTED,
    selections: { d1: ["p1", "p2"] },
    source: LINEUP_SOURCE.CAPTAIN,
  };

  return teamData;
}

test("normalizeMissingLineupPolicy maps legacy values", () => {
  assert.equal(normalizeMissingLineupPolicy("forfeit"), "forfeit_pending");
  assert.equal(normalizeMissingLineupPolicy("btc_override"), "manual_pending");
  assert.equal(normalizeMissingLineupPolicy("random"), "random");
});

test("canLock false before deadline when team missing lineup", () => {
  const teamData = buildFixture({ deadlineOffsetMs: 60_000 });
  const matchup = teamData.matchups[0];
  const state = resolveMatchupMissingLineupState({
    teamData,
    matchup,
    policy: MISSING_LINEUP_POLICY.RANDOM,
    serverTimeMs: Date.now(),
  });
  assert.equal(state.missingTeamIds.includes("team-b"), true);
  assert.equal(state.canLock, false);
});

test("canLock true after deadline with random policy even if missing", () => {
  const teamData = buildFixture({ deadlineOffsetMs: -60_000 });
  const matchup = teamData.matchups[0];
  const state = resolveMatchupMissingLineupState({
    teamData,
    matchup,
    policy: MISSING_LINEUP_POLICY.RANDOM,
    serverTimeMs: Date.now(),
  });
  assert.equal(state.canLock, true);
  assert.ok(state.canRandomizeTeamIds.includes("team-b"));
});

test("random lineup policy handled when source random and submitted", () => {
  const lineup = {
    status: LINEUP_STATUS.SUBMITTED,
    source: LINEUP_SOURCE.RANDOM,
    selections: { d1: ["p5", "p6"] },
  };
  assert.equal(isMissingLineupPolicyHandled(lineup, MISSING_LINEUP_POLICY.RANDOM), true);
});

test("forfeit_pending policy marks handled via audit note", () => {
  const lineup = {
    status: LINEUP_STATUS.NOT_SUBMITTED,
    auditNote: "tt2d:forfeit_pending",
  };
  assert.equal(isMissingLineupPolicyHandled(lineup, MISSING_LINEUP_POLICY.FORFEIT_PENDING), true);
});

test("lock transition blocks captain save/submit after locked", () => {
  const blockedSave = assertLineupTransitionAllowed({
    action: LINEUP_ACTION.SAVE_DRAFT,
    fromStatus: LINEUP_STATUS.LOCKED,
  });
  assert.equal(blockedSave.ok, false);

  const blockedSubmit = assertLineupTransitionAllowed({
    action: LINEUP_ACTION.SUBMIT,
    fromStatus: LINEUP_STATUS.LOCKED,
  });
  assert.equal(blockedSubmit.ok, false);
});

test("blob lock with forfeit_pending marks team instead of hard fail", () => {
  const teamData = buildFixture({
    policy: MISSING_LINEUP_POLICY.FORFEIT_PENDING,
    deadlineOffsetMs: -60_000,
  });
  const players = [
    { id: "p1", gender: "Nam" },
    { id: "p2", gender: "Nam" },
    { id: "p3", gender: "Nữ" },
    { id: "p4", gender: "Nữ" },
    { id: "p5", gender: "Nam" },
    { id: "p6", gender: "Nam" },
    { id: "p7", gender: "Nữ" },
    { id: "p8", gender: "Nữ" },
  ];
  const locked = lockMatchupLineups(teamData, {
    matchupId: "m1",
    players,
    now: new Date().toISOString(),
  });
  assert.equal(locked.ok, true);
  assert.match(
    locked.teamData.lineups[lineupKey("m1", "team-b")].auditNote || "",
    /forfeit_pending/
  );
});

test("isDeadlinePassed respects lineupLockAt", () => {
  const past = { lineupLockAt: new Date(Date.now() - 1000).toISOString() };
  const future = { lineupLockAt: new Date(Date.now() + 60_000).toISOString() };
  assert.equal(isDeadlinePassed(past), true);
  assert.equal(isDeadlinePassed(future), false);
});
