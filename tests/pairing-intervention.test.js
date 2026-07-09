import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_TYPE, TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";
import { suggestEntriesFromPlayers } from "../src/tournament/engines/teamPairingEngine.js";
import { assignEntriesToGroupsSnake } from "../src/tournament/engines/seededGroupEngine.js";
import {
  swapPlayersBetweenEntries,
  movePlayerToEntry,
  dissolveEntry,
  validateEntryForEventType,
} from "../src/features/pairing-intervention/engines/entryInterventionEngine.js";
import {
  moveEntryBetweenGroups,
  swapEntriesBetweenGroups,
  rebuildGroupSchedule,
} from "../src/features/pairing-intervention/engines/groupInterventionEngine.js";

function buildMixedPlayers(maleCount, femaleCount) {
  const males = Array.from({ length: maleCount }, (_, index) => ({
    id: `male-${index + 1}`,
    name: `Nam ${index + 1}`,
    gender: "Nam",
    level: 3 + index * 0.1,
    rating: 3 + index * 0.1,
  }));
  const females = Array.from({ length: femaleCount }, (_, index) => ({
    id: `female-${index + 1}`,
    name: `Nu ${index + 1}`,
    gender: "Nữ",
    level: 3 + index * 0.1,
    rating: 3 + index * 0.1,
  }));
  return [...males, ...females];
}

test("swapPlayersBetweenEntries swaps players in mixed doubles", () => {
  const players = buildMixedPlayers(4, 4);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  const entryA = entries[0];
  const entryB = entries[1];
  const playerIdA = entryA.playerIds[0];
  const playerIdB = entryB.playerIds[0];

  const result = swapPlayersBetweenEntries(
    entries,
    {
      entryIdA: entryA.id,
      playerIdA,
      entryIdB: entryB.id,
      playerIdB,
    },
    players,
    EVENT_TYPE.MIXED_DOUBLE
  );

  assert.equal(result.ok, true);
  const allPlayerIds = result.entries.flatMap((entry) => entry.playerIds);
  assert.ok(allPlayerIds.includes(playerIdA));
  assert.ok(allPlayerIds.includes(playerIdB));
  const entryWithB = result.entries.find((entry) => entry.playerIds.includes(playerIdB));
  const entryWithA = result.entries.find((entry) => entry.playerIds.includes(playerIdA));
  assert.ok(entryWithB);
  assert.ok(entryWithA);
  assert.notEqual(entryWithB.id, entryWithA.id);
});

test("movePlayerToEntry rejects full target team", () => {
  const players = buildMixedPlayers(4, 4);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  const source = entries[0];
  const target = entries[1];
  const movingPlayerId = source.playerIds[0];

  const result = movePlayerToEntry(
    entries,
    {
      playerId: movingPlayerId,
      fromEntryId: source.id,
      toEntryId: target.id,
    },
    players,
    EVENT_TYPE.MIXED_DOUBLE
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("đủ số VĐV")));
});

test("dissolveEntry removes team and returns unpaired players", () => {
  const players = buildMixedPlayers(4, 4);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  const target = entries[0];
  const result = dissolveEntry(entries, target.id, players, EVENT_TYPE.MIXED_DOUBLE);

  assert.equal(result.ok, true);
  assert.equal(result.entries.length, entries.length - 1);
  assert.equal(result.unpairedPlayerIds.length, 2);
});

test("validateEntryForEventType rejects invalid mixed pair", () => {
  const players = buildMixedPlayers(2, 2);
  const invalidEntry = {
    id: "bad",
    name: "Bad",
    playerIds: ["male-1", "male-2"],
    rating: 6,
  };

  const result = validateEntryForEventType(invalidEntry, players, EVENT_TYPE.MIXED_DOUBLE);
  assert.equal(result.ok, false);
});

test("moveEntryBetweenGroups updates groups and rebuilds schedule", () => {
  const players = buildMixedPlayers(8, 8);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });
  const groups = assignEntriesToGroupsSnake(entries, 4, players).map((group) => ({
    ...group,
    tournamentId: "t1",
    eventId: "e1",
  }));

  const sourceGroup = groups[0];
  const targetGroup = groups[1];
  const entryId = sourceGroup.entryIds[0];

  const result = moveEntryBetweenGroups(
    groups,
    {
      entryId,
      fromGroupId: sourceGroup.id,
      toGroupId: targetGroup.id,
    },
    entries,
    players,
    { tournamentId: "t1", eventId: "e1" }
  );

  assert.equal(result.ok, true);
  assert.ok(
    result.groups.find((group) => group.id === targetGroup.id).entryIds.includes(entryId)
  );
  assert.ok(result.matches.length > 0);
});

test("swapEntriesBetweenGroups swaps entries across groups", () => {
  const players = buildMixedPlayers(8, 8);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });
  const groups = assignEntriesToGroupsSnake(entries, 4, players).map((group) => ({
    ...group,
    tournamentId: "t1",
    eventId: "e1",
  }));

  const groupA = groups[0];
  const groupB = groups[1];
  const entryA = groupA.entryIds[0];
  const entryB = groupB.entryIds[0];

  const result = swapEntriesBetweenGroups(
    groups,
    {
      entryIdA: entryA,
      groupIdA: groupA.id,
      entryIdB: entryB,
      groupIdB: groupB.id,
    },
    entries,
    players,
    { tournamentId: "t1", eventId: "e1" }
  );

  assert.equal(result.ok, true);
  assert.ok(result.groups.find((group) => group.id === groupA.id).entryIds.includes(entryB));
  assert.ok(result.groups.find((group) => group.id === groupB.id).entryIds.includes(entryA));
});

test("rebuildGroupSchedule regenerates round-robin matches", () => {
  const players = buildMixedPlayers(8, 8);
  const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });
  const groups = assignEntriesToGroupsSnake(entries, 4, players).map((group) => ({
    ...group,
    tournamentId: "t1",
    eventId: "e1",
  }));

  const result = rebuildGroupSchedule(groups, entries, players, {
    tournamentId: "t1",
    eventId: "e1",
  });

  assert.equal(result.ok, true);
  assert.ok(result.matches.length > 0);
  assert.equal(result.groups.length, 4);
});
