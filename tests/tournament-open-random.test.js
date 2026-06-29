import test from "node:test";
import assert from "node:assert/strict";

import { createEntryRecord, EVENT_TYPE, OFFICIAL_MODE } from "../src/models/tournament/index.js";
import {
  assignEntriesOpenConditional,
  analyzeOpenDrawWarnings,
  getEntryClub,
} from "../src/tournament/engines/openConditionalRandomEngine.js";
import {
  buildOfficialOpenPlan,
  stripOpenEntryMetadata,
} from "../src/tournament/engines/officialTournamentEngine.js";

function buildPlayersForEntries(entries) {
  const players = [];

  entries.forEach((entry) => {
    (entry.playerIds || []).forEach((playerId) => {
      players.push({
        id: playerId,
        name: `Player ${playerId}`,
        gender: "Nam",
        clubName: entry.clubName,
      });
    });
  });

  return players;
}

function buildMenDoubleEntries(distribution) {
  return distribution.flatMap(({ club, count, unitName = "" }) =>
    Array.from({ length: count }, (_, index) =>
      createEntryRecord({
        id: `${club}-${index + 1}`,
        name: `${club} Cap ${index + 1}`,
        playerIds: [`${club}-m${index * 2 + 1}`, `${club}-m${index * 2 + 2}`],
        clubName: club,
        representativeClubName: club,
        unitName,
        rating: 4 + index * 0.2,
        seed: index + 1,
      })
    )
  );
}

test("assignEntriesOpenConditional balances 20 pairs across 4 groups", () => {
  const entries = buildMenDoubleEntries([
    { club: "CLB A", count: 5 },
    { club: "CLB B", count: 5 },
    { club: "CLB C", count: 5 },
    { club: "Vang lai", count: 5 },
  ]);

  const draw = assignEntriesOpenConditional(entries, 4, {
    randomFn: () => 0.42,
    hostClubName: "CLB A",
  });

  assert.equal(draw.ok, true);
  assert.deepEqual(draw.balance.sizes, [5, 5, 5, 5]);
  assert.equal(draw.groups.length, 4);
});

test("open draw spreads dominant club as evenly as possible", () => {
  const entries = buildMenDoubleEntries([
    { club: "CLB Tam Binh", count: 12 },
    { club: "CLB B", count: 4 },
    { club: "Vang lai", count: 4 },
  ]);

  const draw = assignEntriesOpenConditional(entries, 4, {
    randomFn: () => 0.15,
    hostClubName: "CLB Tam Binh",
  });

  assert.equal(draw.ok, true);
  assert.deepEqual(draw.balance.sizes, [5, 5, 5, 5]);

  const hostCounts = draw.groups.map(
    (group) =>
      (group.entries || []).filter((entry) => getEntryClub(entry) === "CLB Tam Binh").length
  );
  assert.ok(Math.max(...hostCounts) <= 4);
  assert.ok(draw.warnings.length > 0);
});

test("buildOfficialOpenPlan strips seed and rating from entries", () => {
  const entries = buildMenDoubleEntries([
    { club: "CLB A", count: 10 },
    { club: "CLB B", count: 10 },
  ]);
  const players = buildPlayersForEntries(entries);

  const plan = buildOfficialOpenPlan({
    tournament: {
      id: "t-open",
      mode: "official_tournament",
      officialMode: OFFICIAL_MODE.OPEN,
      hostClubName: "CLB A",
      events: [],
    },
    entries,
    eventType: EVENT_TYPE.MEN_DOUBLE,
    groupCount: 4,
    players,
    randomFn: () => 0.33,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.event.entries.every((entry) => entry.seed == null), true);
  assert.equal(plan.event.entries.every((entry) => entry.rating === 0), true);
  assert.equal(plan.matchCount, 40);
  assert.equal(plan.event.groups.length, 4);
});

test("stripOpenEntryMetadata removes competitive metadata", () => {
  const entry = stripOpenEntryMetadata(
    createEntryRecord({
      id: "e1",
      name: "Cap 1",
      playerIds: ["1", "2"],
      rating: 8,
      seed: 1,
    })
  );

  assert.equal(entry.rating, 0);
  assert.equal(entry.seed, null);
});

test("analyzeOpenDrawWarnings flags clubs with too many pairs", () => {
  const entries = buildMenDoubleEntries([{ club: "CLB Tam Binh", count: 12 }]);
  const warnings = analyzeOpenDrawWarnings(
    [
      { entries: entries.slice(0, 6) },
      { entries: entries.slice(6) },
    ],
    entries,
    { playersById: new Map() }
  );

  assert.ok(
    warnings.some((warning) => warning.includes("CLB Tam Binh")),
    "expected club split warning"
  );
});

test("buildOfficialOpenPlan creates full schedule for Test 3 scenario", () => {
  const entries = buildMenDoubleEntries([
    { club: "CLB Tam Binh", count: 6 },
    { club: "CLB B", count: 5 },
    { club: "CLB C", count: 5 },
    { club: "Vang lai", count: 4 },
  ]);
  const players = buildPlayersForEntries(entries);

  const plan = buildOfficialOpenPlan({
    tournament: {
      id: "t-test3",
      mode: "official_tournament",
      officialMode: OFFICIAL_MODE.OPEN,
      hostClubName: "CLB Tam Binh",
      events: [],
    },
    entries,
    eventType: EVENT_TYPE.MEN_DOUBLE,
    groupCount: 4,
    players,
    splitUnits: true,
    randomFn: () => 0.2,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.event.entries.length, 20);
  assert.equal(plan.event.matches.length, 40);
  assert.equal(plan.balance.balanced, true);
});
