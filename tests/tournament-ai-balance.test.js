import test from "node:test";
import assert from "node:assert/strict";

import { EVENT_TYPE, OFFICIAL_MODE } from "../src/models/tournament/index.js";
import {
  assignSeedsToEntries,
  suggestBalancedEntriesFromIndividuals,
} from "../src/tournament/engines/teamPairingEngine.js";
import {
  buildOfficialAiBalancePlan,
  buildOfficialAiBalancePatch,
  createOfficialEventRecord,
  upsertOfficialEvent,
} from "../src/tournament/engines/officialTournamentEngine.js";
import { generateKnockoutBracket } from "../src/tournament/engines/bracketEngine.js";
import { MATCH_STATUS } from "../src/models/tournament/constants.js";

function buildMalePlayers(count, startRating = 5) {
  return Array.from({ length: count }, (_, index) => ({
    id: `male-${index + 1}`,
    name: `Nam ${index + 1}`,
    gender: "Nam",
    rating: startRating - index * 0.25,
    level: startRating - index * 0.25,
  }));
}

test("suggestBalancedEntriesFromIndividuals pairs 16 men into 8 balanced teams", () => {
  const players = buildMalePlayers(16);
  const entries = suggestBalancedEntriesFromIndividuals(players, EVENT_TYPE.MEN_DOUBLE, {
    tournamentId: "t1",
    eventId: "e1",
  });

  assert.equal(entries.length, 8);
  assert.equal(entries[0].seed, 1);
  assert.equal(entries[7].seed, 8);
  assert.ok(entries[0].rating >= entries[1].rating);

  const usedPlayers = new Set();
  entries.forEach((entry) => {
    assert.equal(entry.playerIds.length, 2);
    entry.playerIds.forEach((playerId) => {
      assert.equal(usedPlayers.has(playerId), false);
      usedPlayers.add(playerId);
    });
  });
});

test("assignSeedsToEntries orders by total rating", () => {
  const players = buildMalePlayers(4);
  const entries = [
    {
      id: "low",
      name: "Low",
      playerIds: ["male-4"],
      rating: 0,
      seed: null,
    },
    {
      id: "high",
      name: "High",
      playerIds: ["male-1", "male-2"],
      rating: 0,
      seed: null,
    },
  ];

  const seeded = assignSeedsToEntries(entries, players);
  assert.equal(seeded[0].id, "high");
  assert.equal(seeded[0].seed, 1);
  assert.equal(seeded[1].seed, 2);
});

test("buildOfficialAiBalancePlan builds seeded groups and schedule for Test 4", () => {
  const players = buildMalePlayers(16);
  const tournament = {
    id: "t-ai",
    mode: "official_tournament",
    officialMode: OFFICIAL_MODE.AI_BALANCE,
    events: [],
  };

  const plan = buildOfficialAiBalancePlan({
    tournament,
    players,
    selectedPlayerIds: players.map((player) => String(player.id)),
    eventType: EVENT_TYPE.MEN_DOUBLE,
    groupCount: 2,
    individualRegistration: true,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.event.entries.length, 8);
  assert.equal(plan.event.groups.length, 2);
  assert.deepEqual(plan.balance.sizes, [4, 4]);
  assert.equal(plan.matchCount, 12);
  assert.equal(plan.event.entries[0].seed, 1);
});

test("buildOfficialAiBalancePatch preserves multiple events", () => {
  const existingEvent = createOfficialEventRecord(
    { id: "t-ai", events: [] },
    { eventType: EVENT_TYPE.WOMEN_DOUBLE, name: "Doi nu" }
  );
  existingEvent.entries = [{ id: "w1", name: "Cap nu 1", playerIds: ["1", "2"] }];

  const players = buildMalePlayers(16);
  const tournament = {
    id: "t-ai",
    mode: "official_tournament",
    events: [existingEvent],
  };

  const plan = buildOfficialAiBalancePlan({
    tournament,
    eventType: EVENT_TYPE.MEN_DOUBLE,
    players,
    selectedPlayerIds: players.map((player) => String(player.id)),
    groupCount: 2,
  });

  const patch = buildOfficialAiBalancePatch(tournament, plan);
  assert.equal(patch.ok, true);
  assert.equal(patch.events.length, 2);
  assert.equal(
    patch.events.find((event) => event.eventType === EVENT_TYPE.WOMEN_DOUBLE)?.entries.length,
    1
  );
});

test("upsertOfficialEvent replaces event by id", () => {
  const first = createOfficialEventRecord({ id: "t1" }, { name: "A" });
  const second = { ...first, name: "A updated" };
  const events = upsertOfficialEvent([first], second);

  assert.equal(events.length, 1);
  assert.equal(events[0].name, "A updated");
});

test("official ai balance plan supports bracket generation path", () => {
  const players = buildMalePlayers(16);
  const plan = buildOfficialAiBalancePlan({
    tournament: { id: "t-ai", events: [] },
    players,
    selectedPlayerIds: players.map((player) => String(player.id)),
    eventType: EVENT_TYPE.MEN_DOUBLE,
    groupCount: 2,
  });

  const completedMatches = plan.event.matches.map((match, index) => ({
    ...match,
    scoreA: index % 2 === 0 ? 11 : 8,
    scoreB: index % 2 === 0 ? 7 : 11,
    winnerId: index % 2 === 0 ? match.entryAId : match.entryBId,
    loserId: index % 2 === 0 ? match.entryBId : match.entryAId,
    status: MATCH_STATUS.COMPLETED,
  }));

  const event = { ...plan.event, matches: completedMatches };
  const bracket = generateKnockoutBracket(event);

  assert.equal(bracket.ok, true);
  assert.equal(bracket.knockoutMatchCount, 3);
});
