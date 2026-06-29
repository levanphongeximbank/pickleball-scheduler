import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_TYPE } from "../src/models/tournament/index.js";
import {
  suggestEntriesFromPlayers,
  assignEntriesToGroupsSnake,
  summarizeGroupBalance,
  buildGroupStageSchedule,
  buildInternalTournamentPlan,
  applyInternalTournamentPlan,
} from "../src/tournament/engines/index.js";

function buildMalePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index + 1}`,
    name: `Nam ${index + 1}`,
    gender: "Nam",
    level: 2 + (index % 5) * 0.5,
  }));
}

function buildMixedPlayers(maleCount, femaleCount) {
  const males = buildMalePlayers(maleCount).map((player, index) => ({
    ...player,
    id: `male-${index + 1}`,
    name: `Nam ${index + 1}`,
  }));
  const females = Array.from({ length: femaleCount }, (_, index) => ({
    id: `female-${index + 1}`,
    name: `Nu ${index + 1}`,
    gender: "Nữ",
    level: 2 + (index % 5) * 0.5,
  }));
  return [...males, ...females];
}

test("suggestEntriesFromPlayers creates 16 men's pairs", () => {
  const players = buildMalePlayers(32);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MEN_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  assert.equal(entries.length, 16);
  assert.equal(entries[0].playerIds.length, 2);
  assert.ok(entries[0].rating > 0);
});

test("assignEntriesToGroupsSnake distributes 16 teams into 4 balanced groups", () => {
  const players = buildMalePlayers(32);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MEN_DOUBLE);
  const groups = assignEntriesToGroupsSnake(entries, 4, players);
  const balance = summarizeGroupBalance(groups);

  assert.equal(groups.length, 4);
  assert.equal(balance.balanced, true);
  assert.deepEqual(balance.sizes, [4, 4, 4, 4]);
});

test("buildGroupStageSchedule creates round-robin matches for each group", () => {
  const players = buildMixedPlayers(8, 8);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE);
  const groups = assignEntriesToGroupsSnake(entries, 2, players).map((group) => ({
    ...group,
    tournamentId: "t1",
    eventId: "e1",
  }));

  const schedule = buildGroupStageSchedule(groups, {
    tournamentId: "t1",
    eventId: "e1",
    players,
  });

  assert.equal(schedule.groups.length, 2);
  assert.equal(schedule.matches.length, 12);
});

test("buildInternalTournamentPlan builds full internal event", () => {
  const players = buildMixedPlayers(8, 8);
  const tournament = {
    id: "t-internal",
    mode: "internal_tournament",
    events: [],
  };

  const plan = buildInternalTournamentPlan({
    tournament,
    players,
    selectedPlayerIds: players.map((player) => String(player.id)),
    eventType: EVENT_TYPE.MIXED_DOUBLE,
    groupCount: 2,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.event.entries.length, 8);
  assert.equal(plan.event.groups.length, 2);
  assert.equal(plan.matchCount, 12);

  const applied = applyInternalTournamentPlan(tournament, plan);
  assert.equal(applied.ok, true);
  assert.equal(applied.tournament.events[0].matches.length, 12);
});

test("suggestEntriesFromPlayers creates men's singles entries", () => {
  const players = buildMalePlayers(16);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MEN_SINGLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  assert.equal(entries.length, 16);
  assert.equal(entries[0].playerIds.length, 1);
  assert.equal(entries[0].seed, 1);
  assert.ok(entries[0].rating > 0);
});

test("buildInternalTournamentPlan builds men's singles internal event", () => {
  const players = buildMalePlayers(16);
  const tournament = {
    id: "t-internal-single",
    mode: "internal_tournament",
    events: [],
  };

  const plan = buildInternalTournamentPlan({
    tournament,
    players,
    selectedPlayerIds: players.map((player) => String(player.id)),
    eventType: EVENT_TYPE.MEN_SINGLE,
    groupCount: 4,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.event.entries.length, 16);
  assert.equal(plan.event.groups.length, 4);
  assert.deepEqual(plan.balance.sizes, [4, 4, 4, 4]);
  assert.ok(plan.matchCount > 0);
});

test("mixed pairing uses one male and one female per entry", () => {
  const players = buildMixedPlayers(6, 6);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE);
  const males = new Set();
  const females = new Set();

  entries.forEach((entry) => {
    const pair = entry.playerIds.map((id) => players.find((player) => String(player.id) === id));
    const genders = pair.map((player) => player.gender);
    assert.ok(genders.includes("Nam"));
    assert.ok(genders.includes("Nữ"));
    males.add(pair.find((player) => player.gender === "Nam")?.id);
    females.add(pair.find((player) => player.gender === "Nữ")?.id);
  });

  assert.equal(males.size, entries.length);
  assert.equal(females.size, entries.length);
});
