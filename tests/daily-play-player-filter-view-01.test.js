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
  getDefaultDailyPlaySettings,
} from "../src/tournament/engines/dailyPlayEngine.js";
import {
  countVisiblePresentedChecked,
  filterPlayersForDailyMatchType,
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
const binaryIds = [...maleIds, ...femaleIds];

function idsOf(list) {
  return list.map((player) => String(player.id));
}

describe("DP-17 match-type visible check-in pool", () => {
  test("men_double shows only canonical males, not name tokens", () => {
    const view = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
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

  test("women_double shows only canonical females, not name tokens", () => {
    const view = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      matchType: DAILY_MATCH_TYPE.WOMEN_DOUBLE,
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

  test("mixed_double and auto show male + female only", () => {
    const mixedView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    });
    const autoView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      matchType: DAILY_MATCH_TYPE.AUTO,
    });
    assert.deepEqual(idsOf(mixedView.visiblePlayers), binaryIds);
    assert.deepEqual(idsOf(autoView.visiblePlayers), binaryIds);
    assert.equal(mixedView.visiblePlayers.some((player) => player.id === "u1"), false);
    assert.equal(autoView.visiblePlayers.some((player) => player.id === "o1"), false);
  });

  test("men_single and men_double show male only; women_single female only", () => {
    const menSingle = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      matchType: DAILY_MATCH_TYPE.MEN_SINGLE,
    });
    const womenSingle = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      matchType: DAILY_MATCH_TYPE.WOMEN_SINGLE,
    });
    assert.deepEqual(idsOf(menSingle.visiblePlayers), maleIds);
    assert.deepEqual(idsOf(womenSingle.visiblePlayers), femaleIds);
  });

  test("open_double shows male + female + other, not unknown", () => {
    const view = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: [],
      matchType: DAILY_MATCH_TYPE.OPEN_DOUBLE,
    });
    assert.deepEqual(idsOf(view.visiblePlayers), [...binaryIds, "o1"]);
    assert.equal(view.visiblePlayers.some((player) => player.id === "u1"), false);
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
    assert.deepEqual(
      idsOf(
        filterPlayersForDailyMatchType(
          [{ id: "u1", gender: null }, { id: "o1", gender: "other" }],
          DAILY_MATCH_TYPE.MIXED_DOUBLE
        )
      ),
      []
    );
  });

  test("visible checked counts stay inside the match-type pool", () => {
    const checkedInPlayerIds = ["m1", "m2", "f1", "u1"];
    const womenView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.WOMEN_DOUBLE,
    });
    assert.equal(womenView.visiblePlayerCount, 3);
    assert.deepEqual(womenView.visibleCheckedPlayerIds, ["f1"]);
    assert.ok(womenView.visibleCheckedCount <= womenView.visiblePlayerCount);

    const menView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
    });
    assert.equal(menView.visibleCheckedCount, 2);
    assert.deepEqual(menView.visibleCheckedPlayerIds, ["m1", "m2"]);

    const mixedView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    });
    assert.equal(mixedView.visibleCheckedCount, 3);
    assert.equal(mixedView.visiblePlayerCount, 6);
  });

  test("presented override count only includes visible rows", () => {
    const view = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds: ["f1"],
      matchType: DAILY_MATCH_TYPE.WOMEN_DOUBLE,
    });
    const presented = new Set(["f1", "m1", "m2"]);
    assert.equal(countVisiblePresentedChecked(view, presented), 1);
  });

  test("bulk check-in targets only visible unchecked players", () => {
    const checkedInPlayerIds = ["m1", "f1"];
    const womenView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.WOMEN_DOUBLE,
    });
    assert.deepEqual(
      listVisibleBulkCheckInTargets(womenView, checkedInPlayerIds),
      ["f2", "f3"]
    );

    const menView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
    });
    assert.deepEqual(
      listVisibleBulkCheckInTargets(menView, checkedInPlayerIds),
      ["m2", "m3"]
    );

    const mixedView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    });
    assert.deepEqual(listVisibleBulkCheckInTargets(mixedView, checkedInPlayerIds), [
      "m2",
      "m3",
      "f2",
      "f3",
    ]);
  });

  test("bulk check-out targets only visible checked players", () => {
    const checkedInPlayerIds = ["m1", "m2", "f1", "f2"];
    const womenView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.WOMEN_DOUBLE,
    });
    assert.deepEqual(listVisibleBulkCheckOutTargets(womenView), ["f1", "f2"]);

    const menView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
    });
    assert.deepEqual(listVisibleBulkCheckOutTargets(menView), ["m1", "m2"]);
  });

  test("match-type switching is presentation-only and preserves checked ids", () => {
    const checkedInPlayerIds = ["m1", "f1", "f2"];
    const snapshot = [...checkedInPlayerIds];
    const mixedView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    });
    const womenView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.WOMEN_DOUBLE,
    });
    const menView = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.MEN_DOUBLE,
    });
    const backToMixed = projectDailyPlayerFilterView({
      players,
      checkedInPlayerIds,
      matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
    });

    assert.deepEqual(checkedInPlayerIds, snapshot);
    assert.deepEqual(womenView.visibleCheckedPlayerIds, ["f1", "f2"]);
    assert.deepEqual(menView.visibleCheckedPlayerIds, ["m1"]);
    assert.deepEqual(
      backToMixed.visibleCheckedPlayerIds,
      mixedView.visibleCheckedPlayerIds
    );
  });
});

describe("DP-17 Fair Match follows Loại trận", () => {
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

  test("mixed doubles uses both genders from checked-in pool", async () => {
    const result = await createFairDailyMatches({
      players: mixedPool,
      settings: pairingSettings(DAILY_MATCH_TYPE.MIXED_DOUBLE),
      tournamentId: "t-mixed",
      matchCount: 1,
      clubId: "club-test",
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

  test("men / women / auto follow matchType", async () => {
    const men = await createFairDailyMatches({
      players: mixedPool,
      settings: pairingSettings(DAILY_MATCH_TYPE.MEN_DOUBLE),
      tournamentId: "t-men",
      matchCount: 1,
      clubId: "club-test",
      skipPrivatePairingPrepare: true,
    });
    assert.equal(men.ok, true);
    assert.equal(men.competitionType, "doubles_men");

    const women = await createFairDailyMatches({
      players: mixedPool,
      settings: pairingSettings(DAILY_MATCH_TYPE.WOMEN_DOUBLE),
      tournamentId: "t-women",
      matchCount: 1,
      clubId: "club-test",
      skipPrivatePairingPrepare: true,
    });
    assert.equal(women.ok, true);
    assert.equal(women.competitionType, "doubles_women");

    const auto = await createFairDailyMatches({
      players: mixedPool,
      settings: pairingSettings(DAILY_MATCH_TYPE.AUTO),
      tournamentId: "t-auto",
      matchCount: 1,
      clubId: "club-test",
      skipPrivatePairingPrepare: true,
    });
    assert.equal(auto.ok, true);
    assert.equal(auto.competitionType, "doubles_mixed");
  });
});

describe("DP-17 DailyPlaySetup wiring", () => {
  test("independent Lọc VĐV is removed and visible pool follows matchType", () => {
    const setupPath = path.join("src", "pages", "tournament", "DailyPlaySetup.jsx");
    const source = fs.readFileSync(setupPath, "utf8");
    assert.match(source, /projectDailyPlayerFilterView/);
    assert.match(source, /matchType,/);
    assert.match(source, /visiblePlayers\.map/);
    assert.match(source, /listVisibleBulkCheckInTargets/);
    assert.match(source, /listVisibleBulkCheckOutTargets/);
    assert.doesNotMatch(source, /Lọc VĐV/);
    assert.doesNotMatch(source, /GENDER_FILTER_OPTIONS/);
    assert.doesNotMatch(source, /setGenderFilter/);
    assert.doesNotMatch(source, /DAILY_GENDER_FILTER/);
    assert.match(source, /DAILY_MATCH_TYPE_OPTIONS/);
    const shapeSource = fs.readFileSync(
      path.join("src", "features", "daily-play", "canonical", "dailyPlayMatchShape.js"),
      "utf8"
    );
    assert.match(shapeSource, /men_single/);
    assert.match(shapeSource, /women_single/);
    assert.match(shapeSource, /open_double/);
    assert.match(shapeSource, /Đơn nam/);
    assert.match(shapeSource, /Đôi tự do/);
    assert.match(shapeSource, /Tự động/);
  });

  test("singles and open doubles are first-class Daily match types", () => {
    assert.equal(DAILY_MATCH_TYPE.MEN_SINGLE, "men_single");
    assert.equal(DAILY_MATCH_TYPE.WOMEN_SINGLE, "women_single");
    assert.equal(DAILY_MATCH_TYPE.OPEN_DOUBLE, "open_double");
    assert.equal(Object.values(DAILY_MATCH_TYPE).includes("auto"), true);
  });
});
