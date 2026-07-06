import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { savePlayersForClub } from "../src/domain/clubStorage.js";
import { getTenantPlayers } from "../src/features/club/services/clubTenantService.js";
import { ensureMultiTenantSeed } from "../src/features/tenant/seed/multiTenantSeed.js";
import { normalizePlayer } from "../src/models/player.js";
import { EVENT_TYPE, PLAYER_TYPE } from "../src/models/tournament/constants.js";
import {
  ALL_CLUBS_FILTER,
  filterTournamentPickerPlayers,
  formatPlayerPickerMeta,
} from "../src/utils/tournamentPlayerPicker.js";

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

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("getTenantPlayers attaches clubName from source club", () => {
  ensureMultiTenantSeed();

  savePlayersForClub(
    [{ id: "picker-p1", name: "Alpha Player", gender: "Nam", level: 3.5, rating: 3.5 }],
    "club-future-arena"
  );

  const players = getTenantPlayers("tenant-future-arena");
  const player = players.find((item) => item.id === "picker-p1");

  assert.ok(player);
  assert.equal(player.sourceClubId, "club-future-arena");
  assert.equal(player.clubName, "Future Arena CLB");
});

test("filterTournamentPickerPlayers filters by club gender search and event type", () => {
  const players = [
    {
      id: "1",
      name: "Nam A",
      gender: "Nam",
      level: 3,
      rating: 3,
      sourceClubId: "club-a",
      clubName: "Club A",
    },
    {
      id: "2",
      name: "Nu B",
      gender: "Nữ",
      level: 3,
      rating: 3,
      sourceClubId: "club-b",
      clubName: "Club B",
    },
    {
      id: "3",
      name: "Nam C",
      gender: "Nam",
      level: 4,
      rating: 4,
      sourceClubId: "club-b",
      clubName: "Club B",
    },
  ];

  const byClub = filterTournamentPickerPlayers(players, {
    clubFilter: "club-a",
    genderFilter: "all",
    search: "",
    eventType: null,
  });
  assert.deepEqual(byClub.map((player) => player.id), ["1"]);

  const byGender = filterTournamentPickerPlayers(players, {
    clubFilter: ALL_CLUBS_FILTER,
    genderFilter: "Nữ",
    search: "",
    eventType: null,
  });
  assert.deepEqual(byGender.map((player) => player.id), ["2"]);

  const bySearch = filterTournamentPickerPlayers(players, {
    clubFilter: ALL_CLUBS_FILTER,
    genderFilter: "all",
    search: "nam c",
    eventType: null,
  });
  assert.deepEqual(bySearch.map((player) => player.id), ["3"]);

  const byEvent = filterTournamentPickerPlayers(players, {
    clubFilter: ALL_CLUBS_FILTER,
    genderFilter: "all",
    search: "",
    eventType: EVENT_TYPE.MEN_DOUBLE,
  });
  assert.deepEqual(byEvent.map((player) => player.id), ["1", "3"]);

  const excluded = filterTournamentPickerPlayers(players, {
    clubFilter: ALL_CLUBS_FILTER,
    genderFilter: "all",
    search: "",
    eventType: null,
    excludePlayerIds: ["1"],
  });
  assert.deepEqual(excluded.map((player) => player.id), ["2", "3"]);
});

test("normalizePlayer preserves guest playerType", () => {
  const player = normalizePlayer({
    id: "guest-1",
    name: "Walk In",
    gender: "Nam",
    level: 2.5,
    playerType: PLAYER_TYPE.GUEST,
    clubName: "",
  });

  assert.equal(player.playerType, PLAYER_TYPE.GUEST);
  assert.equal(player.genderKey, "male");
});

test("formatPlayerPickerMeta includes gender rating and club", () => {
  assert.equal(
    formatPlayerPickerMeta({ gender: "Nam", rating: 3.5, clubName: "Future Arena" }),
    "Nam • 3.5 • Future Arena"
  );
  assert.equal(formatPlayerPickerMeta({ gender: "Nữ", level: 2.75 }), "Nữ • 2.75");
});
