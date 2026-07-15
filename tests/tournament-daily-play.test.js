import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  DAILY_MATCH_TYPE,
  DAILY_GENDER_FILTER,
  toggleDailyCheckIn,
  getBusyPlayerIdsFromDailyMatches,
  resolveDailyCompetitionType,
  partitionDailyMatches,
  createFairDailyMatches,
  assignDailyMatchToCourt,
  submitDailyPlayMatchScore,
  getDefaultDailyPlaySettings,
} from "../src/tournament/engines/dailyPlayEngine.js";
import { MATCH_STATUS } from "../src/models/tournament/index.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

const players = [
  { id: 1, name: "Nam 1", gender: "Nam", level: 4 },
  { id: 2, name: "Nam 2", gender: "Nam", level: 3.5 },
  { id: 3, name: "Nam 3", gender: "Nam", level: 3 },
  { id: 4, name: "Nam 4", gender: "Nam", level: 2.5 },
  { id: 5, name: "Nu 1", gender: "Nữ", level: 4 },
  { id: 6, name: "Nu 2", gender: "Nữ", level: 3.5 },
  { id: 7, name: "Nu 3", gender: "Nữ", level: 3 },
  { id: 8, name: "Nu 4", gender: "Nữ", level: 2.5 },
];

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  loadClubData(DEFAULT_CLUB.id);
});

afterEach(() => {});

test("toggleDailyCheckIn adds and removes player", () => {
  let settings = getDefaultDailyPlaySettings();
  settings = toggleDailyCheckIn(settings, 1);
  assert.deepEqual(settings.checkedInPlayerIds, ["1"]);
  settings = toggleDailyCheckIn(settings, 1);
  assert.deepEqual(settings.checkedInPlayerIds, []);
});

test("resolveDailyCompetitionType auto picks mixed when enough genders", () => {
  const type = resolveDailyCompetitionType(DAILY_MATCH_TYPE.AUTO, players);
  assert.equal(type, "doubles_mixed");
});

test("getBusyPlayerIdsFromDailyMatches tracks active players", () => {
  const busy = getBusyPlayerIdsFromDailyMatches([
    {
      status: MATCH_STATUS.PLAYING,
      teamAPlayerIds: ["1", "2"],
      teamBPlayerIds: ["3", "4"],
    },
    {
      status: MATCH_STATUS.COMPLETED,
      teamAPlayerIds: ["5", "6"],
      teamBPlayerIds: ["7", "8"],
    },
  ]);

  assert.equal(busy.has("1"), true);
  assert.equal(busy.has("5"), false);
});

test("createFairDailyMatches builds waiting matches for mixed doubles", async () => {
  const settings = {
    ...getDefaultDailyPlaySettings(),
    checkedInPlayerIds: players.map((player) => String(player.id)),
    matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    genderFilter: DAILY_GENDER_FILTER.ALL,
  };

  const result = await createFairDailyMatches({
    players,
    settings,
    tournamentId: "t1",
    matchCount: 1,
  });

  assert.equal(result.ok, true);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].status, MATCH_STATUS.WAITING);
  assert.equal(result.matches[0].teamAPlayerIds.length, 2);
  assert.equal(result.matches[0].teamBPlayerIds.length, 2);
});

test("createFairDailyMatches does not reuse busy players", async () => {
  const settings = {
    ...getDefaultDailyPlaySettings(),
    checkedInPlayerIds: players.map((player) => String(player.id)),
    matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
    matches: [
      {
        id: "m-busy",
        status: MATCH_STATUS.PLAYING,
        teamAPlayerIds: ["1", "2"],
        teamBPlayerIds: ["3", "4"],
      },
    ],
  };

  const result = await createFairDailyMatches({
    players,
    settings,
    tournamentId: "t1",
    matchCount: 1,
  });

  assert.equal(result.ok, false);
});

test("assignDailyMatchToCourt puts waiting match on available court", () => {
  const settings = {
    ...getDefaultDailyPlaySettings(),
    matches: [
      {
        id: "m1",
        status: MATCH_STATUS.WAITING,
        teamAPlayerIds: ["1", "2"],
        teamBPlayerIds: ["3", "4"],
        teamALabel: "A",
        teamBLabel: "B",
      },
    ],
  };

  const result = assignDailyMatchToCourt({
    settings,
    courts: [{ id: 10, name: "San 1", active: true }],
    matchId: "m1",
    lockedCourtIds: [],
  });

  assert.equal(result.ok, true);
  const assigned = result.settings.matches.find((item) => item.id === "m1");
  assert.equal(assigned.courtId, "10");
  assert.equal(assigned.status, MATCH_STATUS.PLAYING);
});

test("submitDailyPlayMatchScore completes match", () => {
  const settings = {
    ...getDefaultDailyPlaySettings(),
    matches: [
      {
        id: "m1",
        status: MATCH_STATUS.PLAYING,
        courtId: 10,
        teamAPlayerIds: ["1", "2"],
        teamBPlayerIds: ["3", "4"],
      },
    ],
  };

  const result = submitDailyPlayMatchScore(settings, "m1", { scoreA: 11, scoreB: 6 });
  assert.equal(result.ok, true);
  assert.equal(result.match.status, MATCH_STATUS.COMPLETED);
  assert.equal(result.match.winnerSide, "A");
});

test("partitionDailyMatches splits lists", () => {
  const grouped = partitionDailyMatches([
    { id: "1", status: MATCH_STATUS.WAITING },
    { id: "2", status: MATCH_STATUS.PLAYING },
    { id: "3", status: MATCH_STATUS.COMPLETED },
  ]);

  assert.equal(grouped.waiting.length, 1);
  assert.equal(grouped.playing.length, 1);
  assert.equal(grouped.completed.length, 1);
});
