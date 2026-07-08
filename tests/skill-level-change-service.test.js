import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData, saveClubData } from "../src/domain/clubStorage.js";
import {
  approveSkillLevelChangeRequest,
  getPlayerPendingSkillLevelRequest,
  listPendingSkillLevelChangeRequests,
  setInitialSkillLevel,
  submitSkillLevelChangeRequest,
} from "../src/domain/skillLevelChangeService.js";
import { processCompletedMatch } from "../src/domain/tournamentLifecycle.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/index.js";
import { normalizePlayer } from "../src/models/player.js";

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
  setActiveClubId(DEFAULT_CLUB.id);
  saveClubData(DEFAULT_CLUB.id, {
    ...loadClubData(DEFAULT_CLUB.id),
    players: [
      {
        id: 1,
        name: "An",
        gender: "Nam",
        level: 3.5,
        rating: 3.5,
        ratingInternal: 3.5,
        skillLevel: 3.5,
        skillLevelLockedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    tournaments: [
      {
        id: "t-daily",
        name: "Daily",
        mode: TOURNAMENT_MODE.DAILY_PLAY,
        leagueId: "league-1",
        settings: {
          dailyPlay: {
            matches: [
              {
                id: "m1",
                status: "completed",
                scoreA: 11,
                scoreB: 5,
                teamAPlayerIds: [1],
                teamBPlayerIds: [2],
              },
            ],
          },
        },
      },
      {
        id: "t-internal",
        name: "Internal",
        mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
        leagueId: "league-1",
        events: [
          {
            id: "e1",
            name: "MD",
            matches: [
              {
                id: "m2",
                status: "completed",
                scoreA: 11,
                scoreB: 8,
                teamAPlayerIds: [1],
                teamBPlayerIds: [2],
              },
            ],
          },
        ],
      },
    ],
  });
});

afterEach(() => {
  globalThis.localStorage = undefined;
});

test("setInitialSkillLevel locks skill level on first create only", () => {
  const created = setInitialSkillLevel({ id: 2, name: "Binh" }, 4.0);
  assert.equal(created.skillLevel, 4.0);
  assert.ok(created.skillLevelLockedAt);

  const again = setInitialSkillLevel(created, 5);
  assert.equal(again.skillLevel, 4.0);
});

test("submit and approve skill level change request updates player skillLevel", () => {
  const submitted = submitSkillLevelChangeRequest(DEFAULT_CLUB.id, 1, 4.0, {
    reason: "Tập luyện tốt hơn",
    requestedBy: "player@test.local",
  });

  assert.equal(submitted.ok, true);
  assert.equal(getPlayerPendingSkillLevelRequest(DEFAULT_CLUB.id, 1)?.status, "pending");

  const approved = approveSkillLevelChangeRequest(
    DEFAULT_CLUB.id,
    submitted.request.id,
    { reviewedBy: "tech@test.local" }
  );

  assert.equal(approved.ok, true);
  const data = loadClubData(DEFAULT_CLUB.id);
  assert.equal(data.players[0].skillLevel, 4);
  assert.equal(listPendingSkillLevelChangeRequests().length, 0);
});

test("daily play match completion does not update skillLevel via Elo", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  const tournament = data.tournaments.find((item) => item.id === "t-daily");
  const match = tournament.settings.dailyPlay.matches[0];

  const result = processCompletedMatch(DEFAULT_CLUB.id, { tournament, match });
  assert.equal(result.eloResult?.skipped, true);
  assert.equal(result.eloResult?.reason, "daily-play-excluded");

  const after = loadClubData(DEFAULT_CLUB.id);
  assert.equal(after.players[0].skillLevel, 3.5);
});

test("normalizePlayer migrates legacy level into skillLevel and lock", () => {
  const player = normalizePlayer({
    id: 9,
    name: "Cuong",
    level: 3.0,
    rating: 3.0,
  });

  assert.equal(player.skillLevel, 3);
  assert.ok(player.skillLevelLockedAt);
});
