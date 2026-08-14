import test, { afterEach, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getPlayerGenderKey } from "../src/models/player.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";
import {
  DAILY_GENDER_FILTER,
  DAILY_MATCH_TYPE,
  createFairDailyMatches,
  filterPlayersByGender,
  getDefaultDailyPlaySettings,
  getEligibleDailyPlayers,
} from "../src/tournament/engines/dailyPlayEngine.js";
import {
  countVisiblePresentedChecked,
  listVisibleBulkCheckInTargets,
  listVisibleBulkCheckOutTargets,
  projectDailyPlayerFilterView,
} from "../src/features/daily-play/canonical/index.js";

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
  { id: "m1", name: "TT412-SEED-M03", gender: "male" },
  { id: "m2", name: "TT412-SEED-M04", gender: "Nam" },
  { id: "m3", name: "TT412-SEED-M05", gender: "M" },
  { id: "f1", name: "TT412-SEED-F01", gender: "female" },
  { id: "f2", name: "TT412-SEED-F02", gender: "Nữ" },
  { id: "f3", name: "TT412-SEED-F03", gender: "F" },
  { id: "u1", name: "Unknown 1", gender: null },
  { id: "o1", name: "Other 1", gender: "other" },
];

const maleIds = ["m1", "m2", "m3"];
const femaleIds = ["f1", "f2", "f3"];

function idsOf(list) {
  return list.map((player) => String(player.id));
}

describe("DP-17 Daily player filter view", () => {
  test("all shows every candidate including unknown/other", () => {
    const view = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      genderFilter: DAILY_GENDER_FILTER.ALL,
    });
    assert.deepEqual(idsOf(view.visiblePlayers), idsOf(players));
    assert.equal(view.visiblePlayerCount, players.length);
  });

  test("male filter shows only canonical males, not name tokens", () => {
    const view = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      genderFilter: DAILY_GENDER_FILTER.MALE,
    });
    assert.deepEqual(idsOf(view.visiblePlayers), maleIds);
    view.visiblePlayers.forEach((player) => {
      assert.equal(getPlayerGenderKey(player.gender), "male");
    });
    assert.equal(
      view.visiblePlayers.some((player) => /Nữ|F0/i.test(player.name)),
      false
    );
  });

  test("female filter shows only canonical females, not name tokens", () => {
    const view = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      genderFilter: DAILY_GENDER_FILTER.FEMALE,
    });
    assert.deepEqual(idsOf(view.visiblePlayers), femaleIds);
    view.visiblePlayers.forEach((player) => {
      assert.equal(getPlayerGenderKey(player.gender), "female");
    });
    assert.equal(
      view.visiblePlayers.some((player) => /SEED-M/i.test(player.name)),
      false
    );
  });

  test("normalization covers canonical, legacy VN/EN, and unknown/null/other", () => {
    assert.equal(getPlayerGenderKey("male"), "male");
    assert.equal(getPlayerGenderKey("Nam"), "male");
    assert.equal(getPlayerGenderKey("M"), "male");
    assert.equal(getPlayerGenderKey("female"), "female");
    assert.equal(getPlayerGenderKey("Nữ"), "female");
    assert.equal(getPlayerGenderKey("F"), "female");
    assert.equal(getPlayerGenderKey(null), null);
    assert.equal(getPlayerGenderKey("other"), "other");
    const unknownOnly = filterPlayersByGender(
      [{ id: "u1", gender: null }, { id: "o1", gender: "other" }],
      DAILY_GENDER_FILTER.FEMALE
    );
    assert.deepEqual(unknownOnly, []);
    const allUnknown = filterPlayersByGender(
      [{ id: "u1", gender: null }, { id: "o1", gender: "other" }],
      DAILY_GENDER_FILTER.ALL
    );
    assert.equal(allUnknown.length, 2);
  });

  test("visible checked counts stay inside the filtered roster", () => {
    const checkedInPlayerIds = ["m1", "m2", "f1", "u1"];
    const femaleView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.FEMALE,
    });
    assert.equal(femaleView.visiblePlayerCount, 3);
    assert.deepEqual(femaleView.visibleCheckedPlayerIds, ["f1"]);
    assert.equal(femaleView.visibleCheckedCount, 1);
    assert.ok(femaleView.visibleCheckedCount <= femaleView.visiblePlayerCount);

    const maleView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.MALE,
    });
    assert.equal(maleView.visibleCheckedCount, 2);
    assert.deepEqual(maleView.visibleCheckedPlayerIds, ["m1", "m2"]);

    const allView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.ALL,
    });
    assert.equal(allView.visibleCheckedCount, 4);
    assert.equal(allView.visiblePlayerCount, players.length);
  });

  test("presented override count only includes visible rows", () => {
    const view = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: ["f1"],
      genderFilter: DAILY_GENDER_FILTER.FEMALE,
    });
    const presented = new Set(["f1", "m1", "m2"]);
    assert.equal(countVisiblePresentedChecked(view, presented), 1);
  });

  test("bulk check-in targets only visible unchecked players", () => {
    const checkedInPlayerIds = ["m1", "f1"];
    const femaleView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.FEMALE,
    });
    assert.deepEqual(
      listVisibleBulkCheckInTargets(femaleView, checkedInPlayerIds),
      ["f2", "f3"]
    );

    const maleView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.MALE,
    });
    assert.deepEqual(
      listVisibleBulkCheckInTargets(maleView, checkedInPlayerIds),
      ["m2", "m3"]
    );

    const allView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.ALL,
    });
    assert.deepEqual(listVisibleBulkCheckInTargets(allView, checkedInPlayerIds), [
      "m2",
      "m3",
      "f2",
      "f3",
      "u1",
      "o1",
    ]);
  });

  test("bulk check-out targets only visible checked players", () => {
    const checkedInPlayerIds = ["m1", "m2", "f1", "f2"];
    const femaleView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.FEMALE,
    });
    assert.deepEqual(listVisibleBulkCheckOutTargets(femaleView), ["f1", "f2"]);

    const maleView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.MALE,
    });
    assert.deepEqual(listVisibleBulkCheckOutTargets(maleView), ["m1", "m2"]);
  });

  test("filter switching is presentation-only and preserves checked ids", () => {
    const checkedInPlayerIds = ["m1", "f1", "f2"];
    const snapshot = [...checkedInPlayerIds];
    const allView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.ALL,
    });
    const femaleView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.FEMALE,
    });
    const maleView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.MALE,
    });
    const backToAll = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.ALL,
    });

    assert.deepEqual(checkedInPlayerIds, snapshot);
    assert.deepEqual(femaleView.visibleCheckedPlayerIds, ["f1", "f2"]);
    assert.deepEqual(maleView.visibleCheckedPlayerIds, ["m1"]);
    assert.deepEqual(backToAll.visibleCheckedPlayerIds, allView.visibleCheckedPlayerIds);
    assert.equal(allView.visiblePlayerCount, players.length);
  });
});

describe("DP-17 match type remains pairing authority", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    setActiveClubId(DEFAULT_CLUB.id);
    loadClubData(DEFAULT_CLUB.id);
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  const mixedPool = [
    { id: "1", name: "Nam 1", gender: "Nam", level: 4 },
    { id: "2", name: "Nam 2", gender: "Nam", level: 3.5 },
    { id: "3", name: "Nam 3", gender: "Nam", level: 3 },
    { id: "4", name: "Nam 4", gender: "Nam", level: 2.5 },
    { id: "5", name: "Nu 1", gender: "Nữ", level: 4 },
    { id: "6", name: "Nu 2", gender: "Nữ", level: 3.5 },
    { id: "7", name: "Nu 3", gender: "Nữ", level: 3 },
    { id: "8", name: "Nu 4", gender: "Nữ", level: 2.5 },
  ];

  function pairingSettings(matchType) {
    return {
      ...getDefaultDailyPlaySettings(),
      checkedInPlayerIds: mixedPool.map((player) => String(player.id)),
      matchType,
      genderFilter: DAILY_GENDER_FILTER.ALL,
    };
  }

  test("mixed doubles still uses both genders when UI filter is female", async () => {
    const uiView = projectDailyPlayerFilterView({
      players: mixedPool,
      checkedInPlayerIds: pairingSettings(DAILY_MATCH_TYPE.MIXED_DOUBLE)
        .checkedInPlayerIds,
      genderFilter: DAILY_GENDER_FILTER.FEMALE,
    });
    assert.equal(uiView.visiblePlayerCount, 4);

    const result = await createFairDailyMatches({
      players: mixedPool,
      settings: pairingSettings(DAILY_MATCH_TYPE.MIXED_DOUBLE),
      tournamentId: "t-mixed",
      matchCount: 1,
      skipPrivatePairingPrepare: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.competitionType, "doubles_mixed");
    const used = [
      ...result.matches[0].teamAPlayerIds,
      ...result.matches[0].teamBPlayerIds,
    ];
    const usedPlayers = mixedPool.filter((player) =>
      used.includes(String(player.id))
    );
    assert.equal(
      usedPlayers.filter((player) => getPlayerGenderKey(player.gender) === "male")
        .length,
      2
    );
    assert.equal(
      usedPlayers.filter((player) => getPlayerGenderKey(player.gender) === "female")
        .length,
      2
    );
  });

  test("men / women / auto still follow matchType, not UI filter", async () => {
    const men = await createFairDailyMatches({
      players: mixedPool,
      settings: pairingSettings(DAILY_MATCH_TYPE.MEN_DOUBLE),
      tournamentId: "t-men",
      matchCount: 1,
      skipPrivatePairingPrepare: true,
    });
    assert.equal(men.ok, true);
    assert.equal(men.competitionType, "doubles_men");

    const women = await createFairDailyMatches({
      players: mixedPool,
      settings: pairingSettings(DAILY_MATCH_TYPE.WOMEN_DOUBLE),
      tournamentId: "t-women",
      matchCount: 1,
      skipPrivatePairingPrepare: true,
    });
    assert.equal(women.ok, true);
    assert.equal(women.competitionType, "doubles_women");

    const auto = await createFairDailyMatches({
      players: mixedPool,
      settings: pairingSettings(DAILY_MATCH_TYPE.AUTO),
      tournamentId: "t-auto",
      matchCount: 1,
      skipPrivatePairingPrepare: true,
    });
    assert.equal(auto.ok, true);
    assert.equal(auto.competitionType, "doubles_mixed");
  });

  test("legacy engine genderFilter still applies only when explicitly set", () => {
    const eligible = getEligibleDailyPlayers({
      players: mixedPool,
      settings: {
        ...pairingSettings(DAILY_MATCH_TYPE.MIXED_DOUBLE),
        genderFilter: DAILY_GENDER_FILTER.FEMALE,
      },
    });
    eligible.forEach((player) => {
      assert.equal(getPlayerGenderKey(player.gender), "female");
    });
  });
});

describe("DP-17 DailyPlaySetup wiring", () => {
  test("setup projects visible players and does not overlay UI filter onto pairing settings", () => {
    const setupPath = path.join("src", "pages", "tournament", "DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.match(source, /projectDailyPlayerFilterView/);
    assert.match(source, /visiblePlayers\.map/);
    assert.match(source, /listVisibleBulkCheckInTargets/);
    assert.match(source, /listVisibleBulkCheckOutTargets/);
    assert.match(source, /visiblePresentedCheckedCount/);
    const pairingBlock = source.match(
      /const dailySettings = useMemo\([\s\S]*?\}, \[session\.dailyPlay, matchType\]\);/
    );
    assert.ok(pairingBlock, "pairing settings must not depend on UI genderFilter");
    assert.doesNotMatch(pairingBlock[0], /genderFilter/);
    assert.doesNotMatch(source, /setGenderFilter\(session\.dailyPlay\.genderFilter\)/);
  });
});
