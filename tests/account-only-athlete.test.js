import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAccountOnlyPlayerId,
  parsePlatformAthleteRouteId,
  resolveAthleteGender,
  enrichAccountOnlyAthlete,
} from "../src/features/club/services/accountOnlyAthleteService.js";
import { loadPlayerHistoryProfileResolved } from "../src/tournament/engines/playerHistoryEngine.js";
import { isPlayerUnrated, filterPlayers, computePlayerDashboardStats } from "../src/utils/playerHelpers.js";
import { normalizePlayer } from "../src/models/player.js";
import { RATING_STATUS } from "../src/features/pick-vn-rating/constants/ratingStatus.js";
import { __setPickVnRatingRpcClientForTests, __resetPickVnRatingRpcClientForTests } from "../src/features/pick-vn-rating/services/pickVnRatingRpcService.js";

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

test("parsePlatformAthleteRouteId — nhận diện profile-uuid", () => {
  const parsed = parsePlatformAthleteRouteId("profile-user-123");
  assert.equal(parsed.isAccountOnly, true);
  assert.equal(parsed.authUserId, "user-123");

  const roster = parsePlatformAthleteRouteId("player-auth-user-123");
  assert.equal(roster.isAccountOnly, false);
  assert.equal(roster.playerId, "player-auth-user-123");
});

test("buildAccountOnlyPlayerId — tạo id route", () => {
  assert.equal(buildAccountOnlyPlayerId("abc"), "profile-abc");
});

test("resolveAthleteGender — map male/female và profile gender", () => {
  assert.equal(resolveAthleteGender({ gender: "Nam" }), "Nam");
  assert.equal(
    resolveAthleteGender({}, { assessmentAnswers: { gender: "female" } }),
    "Nữ"
  );
  assert.equal(resolveAthleteGender({}), "");
});

test("normalizePlayer — giữ unrated khi chưa có điểm", () => {
  const player = normalizePlayer({
    id: "profile-u1",
    name: "Test",
    rating_status: RATING_STATUS.UNRATED,
    level: null,
    rating: null,
    skillLevel: null,
    current_rating: null,
  });

  assert.equal(player.rating_status, RATING_STATUS.UNRATED);
  assert.equal(player.level, null);
  assert.equal(isPlayerUnrated(player), true);
});

test("loadPlayerHistoryProfileResolved — trả isAccountOnlyRoute cho profile-uuid", () => {
  globalThis.localStorage = createLocalStorageMock();

  const result = loadPlayerHistoryProfileResolved({
    secondaryClubId: "club-test",
    playerId: "profile-user-99",
  });

  assert.equal(result.ok, false);
  assert.equal(result.isAccountOnlyRoute, true);
  assert.equal(result.authUserId, "user-99");

  delete globalThis.localStorage;
});

test("enrichAccountOnlyAthlete — lấy rating từ RPC", async () => {
  globalThis.localStorage = createLocalStorageMock();

  __setPickVnRatingRpcClientForTests({
    rpc(name, args) {
      assert.equal(name, "pick_vn_get_rating_by_auth_user");
      assert.equal(args.p_auth_user_id, "user-rated");
      return {
        data: {
          ok: true,
          record: {
            id: "pvn-rating-user-rated",
            auth_user_id: "user-rated",
            current_rating: 4.5,
            rating_status: "self_declared",
          },
        },
        error: null,
      };
    },
  });

  const player = await enrichAccountOnlyAthlete({
    id: "user-rated",
    displayName: "Rated Player",
    email: "rated@example.com",
    role: "PLAYER",
    gender: "male",
  });

  assert.equal(player.name, "Rated Player");
  assert.equal(player.gender, "Nam");
  assert.equal(Number(player.level), 4.5);
  assert.equal(player.linkStatus, "account_only");

  __resetPickVnRatingRpcClientForTests();
  delete globalThis.localStorage;
});

function makeUnratedAccountOnlyPlayer(id) {
  return normalizePlayer({
    id: `profile-${id}`,
    name: `VĐV ${id}`,
    rating_status: RATING_STATUS.UNRATED,
    level: null,
    rating: null,
    skillLevel: null,
    current_rating: null,
    linkStatus: "account_only",
  });
}

test("filterPlayers — unrated account-only VĐV pass level filter mặc định", () => {
  const players = Array.from({ length: 5 }, (_, i) => makeUnratedAccountOnlyPlayer(i + 1));

  const filtered = filterPlayers(players, { levelRange: [1.0, 8.0] });

  assert.equal(filtered.length, 5);
  assert.equal(players.every(isPlayerUnrated), true);
});

test("filterPlayers — unrated vẫn hiện khi rated bị loại bởi level range", () => {
  const unrated = makeUnratedAccountOnlyPlayer("u1");
  const rated = normalizePlayer({
    id: "player-rated",
    name: "Rated",
    level: 4.0,
    rating_status: RATING_STATUS.SELF_DECLARED,
  });

  const filtered = filterPlayers([unrated, rated], { levelRange: [5.0, 8.0] });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, unrated.id);
});

test("computePlayerDashboardStats — averageLevel chỉ tính VĐV đã có level", () => {
  const players = [
    makeUnratedAccountOnlyPlayer("u1"),
    makeUnratedAccountOnlyPlayer("u2"),
    normalizePlayer({
      id: "player-rated",
      name: "Rated",
      level: 4.0,
      rating_status: RATING_STATUS.SELF_DECLARED,
    }),
  ];

  const stats = computePlayerDashboardStats(players);

  assert.equal(stats.total, 3);
  assert.equal(stats.averageLevel, 4.0);
});
