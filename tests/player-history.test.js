import test from "node:test";
import assert from "node:assert/strict";

import { MATCH_STATUS, TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import { createMatchRecord } from "../src/models/tournament/match.js";
import {
  applyMatchRecordToStats,
  buildPlayerHistoryProfile,
  collectMatchRecordsFromTournaments,
  createEmptyPlayerHistoryStats,
  dailyMatchToRecord,
  eventMatchToRecord,
  loadPlayerHistoryProfileResolved,
  mergeLegacyAiHistory,
} from "../src/tournament/engines/playerHistoryEngine.js";
import { saveClubData, getDefaultClubData } from "../src/domain/clubStorage.js";
import { DEFAULT_CLUB, setActiveClubId } from "../src/data/club.js";

const players = [
  { id: "p1", name: "Nam 1", gender: "Nam", rating: 4.5 },
  { id: "p2", name: "Nam 2", gender: "Nam", rating: 4 },
  { id: "p3", name: "Nam 3", gender: "Nam", rating: 3.8 },
  { id: "p4", name: "Nam 4", gender: "Nam", rating: 3.5 },
];

test("dailyMatchToRecord captures completed daily play match", () => {
  const record = dailyMatchToRecord(
    {
      id: "d1",
      status: MATCH_STATUS.COMPLETED,
      teamAPlayerIds: ["p1", "p2"],
      teamBPlayerIds: ["p3", "p4"],
      scoreA: 11,
      scoreB: 8,
      createdAt: "2026-06-01T10:00:00.000Z",
    },
    { id: "t-daily", name: "Daily 1/6", mode: TOURNAMENT_MODE.DAILY_PLAY }
  );

  assert.ok(record);
  assert.equal(record.playerIds.length, 4);
  assert.equal(record.source, "daily_play");
});

test("applyMatchRecordToStats updates wins partners and opponents", () => {
  const record = {
    teamAPlayerIds: ["p1", "p2"],
    teamBPlayerIds: ["p3", "p4"],
    scoreA: 11,
    scoreB: 6,
  };

  const stats = applyMatchRecordToStats(createEmptyPlayerHistoryStats(), record, "p1");
  assert.equal(stats.matchesPlayed, 1);
  assert.equal(stats.wins, 1);
  assert.equal(stats.partners.p2, 1);
  assert.equal(stats.opponents.p3, 1);
});

test("eventMatchToRecord resolves entry player ids", () => {
  const record = eventMatchToRecord(
    createMatchRecord({
      id: "m1",
      entryAId: "e1",
      entryBId: "e2",
      scoreA: 11,
      scoreB: 9,
      status: MATCH_STATUS.COMPLETED,
      completedAt: "2026-06-02T10:00:00.000Z",
    }),
    { id: "t1", name: "Giai noi bo" },
    {
      id: "ev1",
      name: "Doi nam",
      entries: [
        { id: "e1", name: "Cap 1", playerIds: ["p1", "p2"] },
        { id: "e2", name: "Cap 2", playerIds: ["p3", "p4"] },
      ],
    }
  );

  assert.ok(record);
  assert.deepEqual(record.teamAPlayerIds, ["p1", "p2"]);
  assert.equal(record.stageLabel, "Vong bang");
});

test("buildPlayerHistoryProfile aggregates daily and internal matches", () => {
  const tournaments = [
    {
      id: "t-daily",
      name: "Daily",
      mode: TOURNAMENT_MODE.DAILY_PLAY,
      settings: {
        dailyPlay: {
          matches: [
            {
              id: "d1",
              status: MATCH_STATUS.COMPLETED,
              teamAPlayerIds: ["p1", "p2"],
              teamBPlayerIds: ["p3", "p4"],
              scoreA: 11,
              scoreB: 7,
              createdAt: "2026-06-01T10:00:00.000Z",
            },
            {
              id: "d2",
              status: MATCH_STATUS.COMPLETED,
              teamAPlayerIds: ["p1", "p3"],
              teamBPlayerIds: ["p2", "p4"],
              scoreA: 9,
              scoreB: 11,
              createdAt: "2026-06-02T10:00:00.000Z",
            },
          ],
        },
      },
    },
    {
      id: "t-internal",
      name: "Noi bo",
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      events: [
        {
          id: "ev1",
          name: "Doi nam",
          entries: [
            { id: "e1", playerIds: ["p1", "p2"] },
            { id: "e2", playerIds: ["p3", "p4"] },
          ],
          matches: [
            createMatchRecord({
              id: "m1",
              entryAId: "e1",
              entryBId: "e2",
              scoreA: 11,
              scoreB: 5,
              status: MATCH_STATUS.COMPLETED,
              completedAt: "2026-06-03T10:00:00.000Z",
            }),
          ],
        },
      ],
    },
  ];

  const profile = buildPlayerHistoryProfile("p1", {
    players,
    tournaments,
    aiHistory: {
      p1: {
        games: 5,
        partners: { p9: 2 },
        opponents: { p8: 1 },
      },
    },
  });

  assert.equal(profile.ok, true);
  assert.equal(profile.stats.matchesPlayed, 3);
  assert.equal(profile.stats.wins, 2);
  assert.equal(profile.stats.losses, 1);
  assert.equal(profile.recentMatches.length, 3);
  assert.ok(profile.topPartners.some((item) => item.playerId === "p2"));
  assert.ok(profile.topOpponents.some((item) => item.playerId === "p3"));
});

test("mergeLegacyAiHistory uses ai games when no tournament records", () => {
  const stats = mergeLegacyAiHistory(createEmptyPlayerHistoryStats(), "p1", {
    games: 4,
    partners: { p2: 3 },
    opponents: { p3: 2 },
  });

  assert.equal(stats.matchesPlayed, 4);
  assert.equal(stats.partners.p2, 3);
  assert.equal(stats.opponents.p3, 2);
});

test("collectMatchRecordsFromTournaments sorts newest first", () => {
  const records = collectMatchRecordsFromTournaments([
    {
      id: "t-daily",
      mode: TOURNAMENT_MODE.DAILY_PLAY,
      settings: {
        dailyPlay: {
          matches: [
            {
              id: "old",
              status: MATCH_STATUS.COMPLETED,
              teamAPlayerIds: ["p1", "p2"],
              teamBPlayerIds: ["p3", "p4"],
              scoreA: 11,
              scoreB: 5,
              createdAt: "2026-06-01T10:00:00.000Z",
            },
            {
              id: "new",
              status: MATCH_STATUS.COMPLETED,
              teamAPlayerIds: ["p1", "p2"],
              teamBPlayerIds: ["p3", "p4"],
              scoreA: 11,
              scoreB: 8,
              createdAt: "2026-06-05T10:00:00.000Z",
            },
          ],
        },
      },
    },
  ]);

  assert.equal(records[0].id, "new");
  assert.equal(records[1].id, "old");
});

test("loadPlayerHistoryProfileResolved finds athlete by authUserId in assigned club", () => {
  globalThis.localStorage = {
    store: new Map(),
    getItem(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    setItem(key, value) {
      this.store.set(key, String(value));
    },
    removeItem(key) {
      this.store.delete(key);
    },
    clear() {
      this.store.clear();
    },
  };

  const clubId = "club-athlete-profile";
  setActiveClubId(clubId);
  saveClubData(clubId, {
    ...getDefaultClubData(clubId),
    players: [
      {
        id: "player-auth-user-1",
        name: "Player Staging A",
        authUserId: "user-1",
        gender: "Nam",
        level: 3.5,
        active: true,
      },
    ],
  });

  const wrongIdProfile = loadPlayerHistoryProfileResolved({
    primaryClubId: "other-club",
    secondaryClubId: clubId,
    playerId: "stale-profile-player-id",
    authUserId: "user-1",
  });

  assert.equal(wrongIdProfile.ok, true);
  assert.equal(wrongIdProfile.clubId, clubId);
  assert.equal(wrongIdProfile.resolvedPlayerId, "player-auth-user-1");
  assert.equal(wrongIdProfile.player.name, "Player Staging A");

  delete globalThis.localStorage;
});
