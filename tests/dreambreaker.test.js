import test from "node:test";
import assert from "node:assert/strict";

import { GENDER_REQUIREMENT, SUB_MATCH_STATUS } from "../src/features/team-tournament/constants.js";
import { createMlpPreset } from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import { validateMlpRoster, addPlayerToTeam } from "../src/features/team-tournament/engines/teamRosterEngine.js";
import { validateMlpLineupParticipation } from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import { normalizeTeamData, createTeamRecord } from "../src/features/team-tournament/models/index.js";
import {
  lockDreambreakerOrders,
  listDreambreakerMatchups,
  maybeActivateDreambreaker,
  randomDreambreakerOrder,
  recordDreambreakerPoint,
  startDreambreaker,
  submitDreambreakerOrder,
  syncDreambreakerForAllMatchups,
} from "../src/features/team-tournament/engines/dreambreakerEngine.js";
import { computeMatchupResult } from "../src/features/team-tournament/engines/teamResultEngine.js";

const players = [
  { id: "m1", name: "M1", gender: "male" },
  { id: "m2", name: "M2", gender: "male" },
  { id: "f1", name: "F1", gender: "female" },
  { id: "f2", name: "F2", gender: "female" },
];

test("MLP roster blocks fifth player", () => {
  const preset = createMlpPreset();
  const team = createTeamRecord({
    id: "team-a",
    playerIds: ["m1", "m2", "f1", "f2"],
  });
  preset.teams = [team];

  const check = validateMlpRoster(team, players, preset);
  assert.equal(check.ok, true);

  const add = addPlayerToTeam(preset, "team-a", "extra", [
    ...players,
    { id: "extra", name: "Extra", gender: "male" },
  ]);
  assert.equal(add.ok, false);
});

test("MLP lineup requires two appearances per player", () => {
  const preset = createMlpPreset();
  const team = createTeamRecord({ id: "team-a", playerIds: ["m1", "m2", "f1", "f2"] });
  preset.teams = [team];

  const mainDisciplines = preset.disciplines.filter(
    (discipline) => discipline.activationRule === "always"
  );
  const wd = mainDisciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE);
  const md = mainDisciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE);
  const mixed = mainDisciplines.filter(
    (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
  );

  const bad = validateMlpLineupParticipation(preset, "team-a", {
    [wd.id]: ["f1", "f2"],
    [md.id]: ["m1", "m2"],
    [mixed[0].id]: ["m1", "f1"],
    [mixed[1].id]: ["m2", "f2"],
  });
  assert.equal(bad.ok, true);

  const incomplete = validateMlpLineupParticipation(preset, "team-a", {
    [wd.id]: ["f1", "f2"],
    [md.id]: ["m1", "m2"],
    [mixed[0].id]: ["m1", "f1"],
    [mixed[1].id]: ["m2", "f2"].slice(0, 1),
  });
  assert.equal(incomplete.ok, false);
});

function buildTwoTwoMatchup() {
  const preset = createMlpPreset();
  const teamA = createTeamRecord({ id: "team-a", playerIds: ["m1", "m2", "f1", "f2"] });
  const teamB = createTeamRecord({ id: "team-b", playerIds: ["m3", "m4", "f3", "f4"] });
  preset.teams = [teamA, teamB];

  const mainDisciplines = preset.disciplines.filter((d) => d.activationRule === "always");
  const subMatches = mainDisciplines.map((discipline, index) => ({
    id: `sub-${index}`,
    disciplineId: discipline.id,
    sortOrder: discipline.sortOrder,
    status: SUB_MATCH_STATUS.COMPLETED,
    score: { teamA: index < 2 ? 21 : 6, teamB: index < 2 ? 6 : 21, games: [] },
    winnerTeamId: index < 2 ? "team-a" : "team-b",
  }));

  preset.matchups = [
    {
      id: "matchup-1",
      teamAId: "team-a",
      teamBId: "team-b",
      status: "in_progress",
      subMatches,
      result: { teamAWins: 2, teamBWins: 2, teamAPoints: 0, teamBPoints: 0, winnerTeamId: "" },
    },
  ];

  return normalizeTeamData(preset);
}

test("2-2 activates dreambreaker", () => {
  let teamData = buildTwoTwoMatchup();
  const aggregated = computeMatchupResult(teamData, "matchup-1");
  teamData = aggregated.teamData;

  assert.equal(aggregated.needsDreambreaker, true);
  assert.equal(teamData.matchups[0].dreambreaker?.status, "lineup_open");
});

test("dreambreaker rotation and win at 21", () => {
  let teamData = buildTwoTwoMatchup();
  teamData = computeMatchupResult(teamData, "matchup-1").teamData;

  teamData = submitDreambreakerOrder(teamData, {
    matchupId: "matchup-1",
    teamId: "team-a",
    order: ["m1", "m2", "f1", "f2"],
  }).teamData;
  teamData = submitDreambreakerOrder(teamData, {
    matchupId: "matchup-1",
    teamId: "team-b",
    order: ["m3", "m4", "f3", "f4"],
  }).teamData;

  teamData = startDreambreaker(teamData, "matchup-1").teamData;

  for (let index = 0; index < 21; index += 1) {
    const result = recordDreambreakerPoint(teamData, {
      matchupId: "matchup-1",
      scoringTeamId: "team-a",
    });
    teamData = result.teamData;
    if (result.completed) {
      break;
    }
  }

  const matchup = teamData.matchups[0];
  assert.equal(matchup.dreambreaker.status, "completed");
  assert.ok(matchup.result.winnerTeamId);
});

test("syncDreambreakerForAllMatchups activates 2-2 without prior dreambreaker object", () => {
  const teamData = buildTwoTwoMatchup();
  assert.notEqual(teamData.matchups[0].dreambreaker?.status, "lineup_open");

  const synced = syncDreambreakerForAllMatchups(teamData);
  assert.equal(synced.changed, true);
  assert.equal(synced.teamData.matchups[0].dreambreaker?.status, "lineup_open");
  assert.ok(synced.teamData.matchups[0].dreambreaker?.orderLockAt);
});

test("lockDreambreakerOrders auto-randomizes missing orders after deadline", () => {
  let teamData = syncDreambreakerForAllMatchups(buildTwoTwoMatchup()).teamData;
  const past = new Date(Date.now() - 60_000).toISOString();
  teamData = {
    ...teamData,
    matchups: teamData.matchups.map((matchup) => ({
      ...matchup,
      dreambreaker: { ...matchup.dreambreaker, orderLockAt: past },
    })),
  };

  const locked = lockDreambreakerOrders(teamData, "matchup-1", { now: new Date().toISOString() });
  assert.equal(locked.ok, true);
  assert.equal(locked.teamData.matchups[0].dreambreaker.status, "ready");
  assert.equal(locked.teamData.matchups[0].dreambreaker.teamAOrder.length, 4);
  assert.equal(locked.teamData.matchups[0].dreambreaker.teamBOrder.length, 4);
  assert.equal(locked.teamData.matchups[0].dreambreaker.orderSourceA, "random");
  assert.equal(locked.teamData.matchups[0].dreambreaker.orderSourceB, "random");
});

test("randomDreambreakerOrder returns four distinct roster players", () => {
  const preset = createMlpPreset();
  const team = createTeamRecord({ id: "team-a", playerIds: ["m1", "m2", "f1", "f2"] });
  preset.teams = [team];
  const order = randomDreambreakerOrder(team);
  assert.equal(order.length, 4);
  assert.equal(new Set(order).size, 4);
});

test("listDreambreakerMatchups surfaces active and pending 2-2 ties", () => {
  const teamData = syncDreambreakerForAllMatchups(buildTwoTwoMatchup()).teamData;
  const all = listDreambreakerMatchups(teamData);
  assert.equal(all.length, 1);

  const forTeamA = listDreambreakerMatchups(teamData, { teamId: "team-a" });
  assert.equal(forTeamA.length, 1);

  const forOther = listDreambreakerMatchups(teamData, { teamId: "missing" });
  assert.equal(forOther.length, 0);
});

test("force lock sets ordersLockedAt and READY", () => {
  let teamData = syncDreambreakerForAllMatchups(buildTwoTwoMatchup()).teamData;
  const locked = lockDreambreakerOrders(teamData, "matchup-1", { force: true });
  assert.equal(locked.ok, true);
  assert.ok(locked.teamData.matchups[0].dreambreaker.ordersLockedAt);
  assert.equal(locked.teamData.matchups[0].dreambreaker.status, "ready");
});

test("submitDreambreakerOrder blocked when ordersLockedAt is set", () => {
  let teamData = syncDreambreakerForAllMatchups(buildTwoTwoMatchup()).teamData;
  teamData = {
    ...teamData,
    matchups: teamData.matchups.map((matchup) => ({
      ...matchup,
      dreambreaker: {
        ...matchup.dreambreaker,
        ordersLockedAt: new Date().toISOString(),
      },
    })),
  };

  const submit = submitDreambreakerOrder(teamData, {
    matchupId: "matchup-1",
    teamId: "team-a",
    order: ["m1", "m2", "f1", "f2"],
  });
  assert.equal(submit.ok, false);
  assert.match(submit.error, /đã khóa/i);
});

test("captain order preserved when submitted before force lock", () => {
  let teamData = syncDreambreakerForAllMatchups(buildTwoTwoMatchup()).teamData;
  teamData = submitDreambreakerOrder(teamData, {
    matchupId: "matchup-1",
    teamId: "team-a",
    order: ["m1", "m2", "f1", "f2"],
  }).teamData;
  teamData = lockDreambreakerOrders(teamData, "matchup-1", { force: true }).teamData;
  const dreambreaker = teamData.matchups[0].dreambreaker;
  assert.deepEqual(dreambreaker.teamAOrder, ["m1", "m2", "f1", "f2"]);
  assert.equal(dreambreaker.orderSourceA, "captain");
  assert.equal(dreambreaker.status, "ready");
});
