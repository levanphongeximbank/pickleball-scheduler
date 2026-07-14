import test from "node:test";
import assert from "node:assert/strict";

import { generateSeed } from "../src/features/tournament-engine/engines/seedEngine.js";
import {
  SEED_RATING_SOURCE,
  enrichParticipantWithRatingV5,
  verifySeedIntegrity,
  applyManualSeedOverride,
  displayRatingToSeedSkill,
} from "../src/features/individual-tournament/adapters/ratingV5SeedAdapter.js";
import {
  buildIndividualAllGroupStandings,
  preparePostTournamentRatingHooks,
} from "../src/features/individual-tournament/adapters/individualStandingsAdapter.js";
import {
  calculateCanonicalStandings,
  createStandingsEntry,
  createStandingsMatchRecord,
  createStandingsRequest,
  createStandingsConfiguration,
  createScoringRule,
  mapLegacyGroupStandingsPayloadToRequest,
} from "../src/features/competition-core/index.js";
import { MATCH_STATUS } from "../src/models/tournament/constants.js";

const FORCE_V2 = {
  forceCanonical: true,
  envSource: {
    VITE_COMPETITION_CORE_ENABLED: "true",
    VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED: "true",
  },
};

test("T-S1-D01 Seed order matches Rating V5 display_rating desc", () => {
  const participants = [
    enrichParticipantWithRatingV5(
      { id: "low", name: "Low", status: "active" },
      [{ ratingV5: { display_rating: 3.2, reliability_score: 0.8 } }]
    ),
    enrichParticipantWithRatingV5(
      { id: "high", name: "High", status: "active" },
      [{ ratingV5: { display_rating: 4.8, reliability_score: 0.9 } }]
    ),
    enrichParticipantWithRatingV5(
      { id: "mid", name: "Mid", status: "active" },
      [{ displayRating: 4.1, reliabilityScore: 0.7 }]
    ),
  ];

  const result = generateSeed({ participants });
  assert.equal(result.ok, true);
  const seeded = result.data.seeded;
  assert.equal(seeded[0].id, "high");
  assert.equal(seeded[0].seed, 1);
  assert.equal(seeded[1].id, "mid");
  assert.equal(seeded[2].id, "low");
  assert.equal(seeded[0].seedRatingSource, SEED_RATING_SOURCE.RATING_V5);
  assert.ok(seeded[0].seedBand);
  assert.equal(verifySeedIntegrity(result.data.participants).ok, true);
  assert.ok(displayRatingToSeedSkill(4.8) > displayRatingToSeedSkill(3.2));
});

test("T-S1-D02 Fallback to legacy Elo when V5 missing", () => {
  const participants = [
    { id: "elo-hi", name: "EloHi", status: "active", elo: 1400, matchesPlayed: 20 },
    enrichParticipantWithRatingV5(
      { id: "v5", name: "V5", status: "active" },
      [{ ratingV5: { display_rating: 3.0, reliability_score: 0.5 } }]
    ),
    { id: "new", name: "Newbie", status: "active", matchesPlayed: 0 },
  ];

  const result = generateSeed({ participants });
  assert.equal(result.ok, true);
  const byId = Object.fromEntries(result.data.participants.map((row) => [row.id, row]));
  assert.equal(byId.v5.seedRatingSource, SEED_RATING_SOURCE.RATING_V5);
  assert.equal(byId["elo-hi"].seed != null, true);
  assert.equal(byId.new.seed, null);
  assert.equal(byId.new.unseeded, true);

  const forbidden = applyManualSeedOverride(result.data.participants, "elo-hi", 1, {
    hasPermission: false,
  });
  assert.equal(forbidden.ok, false);
  const allowed = applyManualSeedOverride(result.data.participants, "elo-hi", 1, {
    hasPermission: true,
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.participants.find((row) => row.id === "elo-hi").manualSeedOverride, true);
});

test("T-S1-D03 STANDINGS_V2 H2H resolves 2-way tie", () => {
  const event = {
    groups: [{ id: "g1", name: "A", entryIds: ["a", "b"] }],
    entries: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    matches: [
      {
        id: "m1",
        groupId: "g1",
        entryAId: "a",
        entryBId: "b",
        status: MATCH_STATUS.COMPLETED,
        scoreA: 11,
        scoreB: 5,
        winnerId: "a",
      },
    ],
  };

  const groups = buildIndividualAllGroupStandings(event, {
    ...FORCE_V2,
    qualifiersPerGroup: 1,
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].source, "standings_v2");
  assert.equal(groups[0].standing[0].id, "a");
  assert.equal(groups[0].standing[0].qualificationStatus, "qualified_1st");
  assert.equal(groups[0].standing[1].qualificationStatus, "eliminated");
  assert.match(groups[0].tieBreakExplanation, /STANDINGS_V2|H2H|match/i);

  const request = createStandingsRequest({
    entries: [
      createStandingsEntry({ entryId: "a", name: "A" }),
      createStandingsEntry({ entryId: "b", name: "B" }),
    ],
    configuration: createStandingsConfiguration({
      scoringRule: createScoringRule({ winPoints: 2, lossPoints: 1 }),
    }),
    matches: [
      createStandingsMatchRecord({
        matchId: "m1",
        entryAId: "a",
        entryBId: "b",
        scoreA: 11,
        scoreB: 5,
        winnerEntryId: "a",
      }),
    ],
  });
  const canonical = calculateCanonicalStandings(request);
  assert.equal(canonical.rows[0].entryId, "a");
});

test("T-S1-D04 STANDINGS_V2 mini-table resolves 3-way tie", () => {
  const event = {
    groups: [{ id: "g1", name: "A", entryIds: ["a", "b", "c"] }],
    entries: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ],
    matches: [
      {
        id: "m1",
        groupId: "g1",
        entryAId: "a",
        entryBId: "b",
        status: MATCH_STATUS.COMPLETED,
        scoreA: 11,
        scoreB: 5,
      },
      {
        id: "m2",
        groupId: "g1",
        entryAId: "b",
        entryBId: "c",
        status: MATCH_STATUS.COMPLETED,
        scoreA: 11,
        scoreB: 5,
      },
      {
        id: "m3",
        groupId: "g1",
        entryAId: "c",
        entryBId: "a",
        status: MATCH_STATUS.COMPLETED,
        scoreA: 11,
        scoreB: 5,
      },
    ],
  };

  const groups = buildIndividualAllGroupStandings(event, FORCE_V2);
  assert.equal(groups[0].standing.length, 3);
  assert.equal(groups[0].source, "standings_v2");
  assert.ok(groups[0].standing.every((row) => row.qualificationStatus));

  const hooks = preparePostTournamentRatingHooks(event, groups);
  assert.equal(hooks.ready, false);
  assert.ok(hooks.note.includes("out of S1-D"));
});

test("T-S1-D05 Individual mapper CC-08 #31 regression", () => {
  const mapped = mapLegacyGroupStandingsPayloadToRequest({
    group: { id: "g1", entryIds: ["a", "b"] },
    entries: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    matches: [
      {
        id: "m1",
        groupId: "g1",
        entryAId: "a",
        entryBId: "b",
        status: "completed",
        scoreA: 11,
        scoreB: 4,
      },
    ],
  });
  const result = calculateCanonicalStandings(mapped.request);
  assert.equal(result.rows.length, 2);

  const groups = buildIndividualAllGroupStandings(
    {
      groups: [{ id: "g1", name: "A", entryIds: ["a", "b"] }],
      entries: mapped.request.entries.map((entry) => ({
        id: entry.entryId,
        name: entry.name,
      })),
      matches: [
        {
          id: "m1",
          groupId: "g1",
          entryAId: "a",
          entryBId: "b",
          status: MATCH_STATUS.COMPLETED,
          scoreA: 11,
          scoreB: 4,
        },
      ],
    },
    FORCE_V2
  );
  assert.equal(groups[0].standing.length, 2);
  assert.equal(groups[0].standing[0].id, "a");
});
