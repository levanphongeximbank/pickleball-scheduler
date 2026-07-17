/**
 * P1.5A Showcase — full-screen reveal adapters (team + group).
 *
 * Proves the reveal steps are derived from the FROZEN engine result only:
 * correct order, every athlete/team once, no duplicates/missing, fingerprints
 * match, final hold is complete, and building steps never re-runs the engine.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { TEAM_GROUP_SEEDING } from "../src/features/team-tournament/constants.js";
import { TT_V6_TT32_ATHLETES } from "../src/features/team-tournament/fixtures/ttV6Tt32StagingFixture.js";
import {
  generateShowcaseTeamDraw,
  generateShowcaseGroupDraw,
  buildReplayShowcaseSession,
  buildShowcaseTeamRevealSteps,
  buildShowcaseGroupRevealSteps,
  assertTeamRevealParity,
  assertGroupRevealParity,
  selectRevealedTeamState,
  selectRevealedGroupState,
} from "../src/features/team-tournament/showcase/index.js";

function toPlayers(rows = TT_V6_TT32_ATHLETES) {
  return rows.map((row) => ({
    id: row.playerId,
    name: row.displayName,
    gender: row.gender === "male" ? "Nam" : "Nữ",
    rating: row.rating,
    level: row.rating,
    ratingValue: row.rating,
    ratingSource: "pick_vn_current",
  }));
}

function fixedRandom() {
  let i = 0;
  const seq = [0.11, 0.42, 0.73, 0.28, 0.55, 0.91, 0.07, 0.63, 0.34, 0.88];
  return () => {
    const value = seq[i % seq.length];
    i += 1;
    return value;
  };
}

function makeTeamSession() {
  return generateShowcaseTeamDraw({
    players: toPlayers(),
    teamCount: 8,
    randomFn: fixedRandom(),
    rulesVersion: "rv-test-1",
  }).session;
}

function makeGroupSession(groupCount = 2) {
  return generateShowcaseGroupDraw(makeTeamSession(), {
    groupCount,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    rulesVersion: "rv-test-1",
    randomFn: fixedRandom(),
  }).session;
}

test("team reveal steps: one step per athlete, order follows frozen teams", () => {
  const session = makeTeamSession();
  const built = buildShowcaseTeamRevealSteps(session);
  assert.equal(built.ok, true);
  // 8 teams * 4 athletes = 32 reveal steps
  assert.equal(built.steps.length, 32);
  assert.equal(built.totalTeams, 8);

  // Steps are grouped by team in order (team 0 fully, then team 1, ...).
  let cursor = 0;
  session.teamCards.forEach((team, teamIndex) => {
    team.athletes.forEach((athlete, athleteIndexInTeam) => {
      const step = built.steps[cursor];
      assert.equal(step.teamIndex, teamIndex);
      assert.equal(step.athleteIndexInTeam, athleteIndexInTeam);
      assert.equal(step.athleteId, String(athlete.id));
      assert.equal(step.teamId, String(team.id));
      cursor += 1;
    });
  });
});

test("team reveal: no duplicate and no missing athlete (parity)", () => {
  const session = makeTeamSession();
  const built = buildShowcaseTeamRevealSteps(session);
  const ids = built.steps.map((s) => s.athleteId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(assertTeamRevealParity(session, built), true);
  assert.equal(built.fingerprint, session.membershipFingerprint);
});

test("team reveal: duplicate athlete across teams is rejected before projecting", () => {
  const session = makeTeamSession();
  const tampered = {
    ...session,
    teamCards: [
      session.teamCards[0],
      {
        ...session.teamCards[1],
        athletes: [session.teamCards[0].athletes[0], ...session.teamCards[1].athletes.slice(1)],
      },
      ...session.teamCards.slice(2),
    ],
  };
  const built = buildShowcaseTeamRevealSteps(tampered);
  assert.equal(built.ok, false);
  assert.match(built.error, /trùng/);
});

test("team reveal derived state fills teams incrementally and holds when complete", () => {
  const session = makeTeamSession();
  const built = buildShowcaseTeamRevealSteps(session);

  const midway = selectRevealedTeamState(built, 5);
  assert.equal(midway.revealedCount, 5);
  assert.equal(midway.isComplete, false);
  // First team fully filled (4), second team has 1 revealed athlete.
  assert.equal(midway.teams[0].revealedAthletes.length, 4);
  assert.equal(midway.teams[1].revealedAthletes.length, 1);
  assert.equal(midway.activeTeamIndex, 1);

  const end = selectRevealedTeamState(built, built.steps.length);
  assert.equal(end.isComplete, true);
  end.teams.forEach((team, index) => {
    assert.equal(team.revealedAthletes.length, session.teamCards[index].athletes.length);
  });
  // Over-revealing clamps and stays complete (final hold never overflows).
  const clamped = selectRevealedTeamState(built, 999);
  assert.equal(clamped.revealedCount, built.steps.length);
  assert.equal(clamped.isComplete, true);
});

test("group reveal steps: 2 groups × 4 teams, ordered by frozen groups", () => {
  const session = makeGroupSession(2);
  const built = buildShowcaseGroupRevealSteps(session);
  assert.equal(built.ok, true);
  assert.equal(built.totalGroups, 2);
  assert.equal(built.steps.length, 8);

  let cursor = 0;
  session.groupSession.groupCards.forEach((group, groupIndex) => {
    group.teams.forEach((team, teamIndexInGroup) => {
      const step = built.steps[cursor];
      assert.equal(step.groupIndex, groupIndex);
      assert.equal(step.teamIndexInGroup, teamIndexInGroup);
      assert.equal(step.teamId, String(team.id));
      assert.equal(step.groupId, String(group.id));
      cursor += 1;
    });
  });
});

test("group reveal steps support 4 groups × 2 teams", () => {
  const session = makeGroupSession(4);
  const built = buildShowcaseGroupRevealSteps(session);
  assert.equal(built.ok, true);
  assert.equal(built.totalGroups, 4);
  assert.equal(built.steps.length, 8);
  assert.equal(assertGroupRevealParity(session, built), true);
});

test("group reveal: no duplicate / no missing team (parity + fingerprint)", () => {
  const session = makeGroupSession(2);
  const built = buildShowcaseGroupRevealSteps(session);
  const ids = built.steps.map((s) => s.teamId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(assertGroupRevealParity(session, built), true);
  assert.equal(built.fingerprint, session.groupSession.groupFingerprint);
});

test("group reveal derived state fills groups incrementally and holds when complete", () => {
  const session = makeGroupSession(2);
  const built = buildShowcaseGroupRevealSteps(session);

  const midway = selectRevealedGroupState(built, 5);
  assert.equal(midway.isComplete, false);
  assert.equal(midway.groups[0].revealedTeams.length, 4);
  assert.equal(midway.groups[1].revealedTeams.length, 1);
  assert.equal(midway.activeGroupIndex, 1);

  const end = selectRevealedGroupState(built, 999);
  assert.equal(end.revealedCount, built.steps.length);
  assert.equal(end.isComplete, true);
  end.groups.forEach((group, index) => {
    assert.equal(
      group.revealedTeams.length,
      session.groupSession.groupCards[index].teams.length
    );
  });
});

test("building reveal steps does not re-run engines (engineRunCount stays 1)", () => {
  const session = makeGroupSession(2);
  assert.equal(session.engineRunCount, 1);
  assert.equal(session.groupSession.engineRunCount, 1);

  buildShowcaseTeamRevealSteps(session);
  buildShowcaseGroupRevealSteps(session);

  assert.equal(session.engineRunCount, 1);
  assert.equal(session.groupSession.engineRunCount, 1);
  // Frozen session cannot be mutated by the adapters.
  assert.equal(Object.isFrozen(session), true);
});

test("replay session yields identical reveal ordering without engine runs", () => {
  const grouped = makeGroupSession(2);
  const replay = buildReplayShowcaseSession({
    teamData: grouped.teamData,
    players: toPlayers(),
    rulesVersion: "rv-test-1",
  });
  assert.equal(replay.engineRunCount, 0);

  const teamBuilt = buildShowcaseTeamRevealSteps(replay);
  const groupBuilt = buildShowcaseGroupRevealSteps(replay);
  assert.equal(teamBuilt.steps.length, 32);
  assert.equal(groupBuilt.steps.length, 8);
  assert.equal(assertTeamRevealParity(replay, teamBuilt), true);
  assert.equal(assertGroupRevealParity(replay, groupBuilt), true);
});

test("empty session is handled without throwing", () => {
  const team = buildShowcaseTeamRevealSteps(null);
  assert.equal(team.ok, false);
  assert.equal(team.steps.length, 0);
  const group = buildShowcaseGroupRevealSteps({ teamCards: [] });
  assert.equal(group.ok, false);
  assert.equal(group.steps.length, 0);
});
