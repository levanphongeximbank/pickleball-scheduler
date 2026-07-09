import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  formatPickVnRating,
  migrateLegacyRating,
  parsePickVnRating,
  snapPickVnRating,
  snapPickVnOnboardingConfirm,
  PICK_VN_PLUS_NUMERIC,
} from "../src/features/pick-vn-rating/constants/pickVnRatingScale.js";
import { migratePlayerRatingFields } from "../src/features/pick-vn-rating/models/pickVnRating.js";
import { RATING_STATUS } from "../src/features/pick-vn-rating/constants/ratingStatus.js";
import {
  resetPickVnRatingLocalStoreForTests,
} from "../src/features/pick-vn-rating/storage/pickVnRatingLocalStore.js";
import {
  completePickVnOnboarding,
  getPickVnRatingByAuthUserId,
  incrementRatingMatchCountForClubPlayers,
  needsPickVnOnboarding,
  saveSelfDeclaredRating,
} from "../src/features/pick-vn-rating/services/pickVnRatingService.js";
import {
  getPlayerCurrentRating,
  getPlayerSkillLevel,
  normalizePlayer,
} from "../src/models/player.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData, saveClubData } from "../src/domain/clubStorage.js";

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

test("snapPickVnRating — fine step up to 4.0, then 0.5 to 6.0+", () => {
  assert.equal(snapPickVnRating(1.5), 1.5);
  assert.equal(snapPickVnRating(1.2), 1.5);
  assert.equal(snapPickVnRating(2.23), 2.2);
  assert.equal(snapPickVnRating(2.4), 2.4);
  assert.equal(snapPickVnRating(3.2), 3.2);
  assert.equal(snapPickVnRating(3.7), 3.7);
  assert.equal(snapPickVnRating(4.3), 4.5);
  assert.equal(snapPickVnRating(6.5), PICK_VN_PLUS_NUMERIC);
  assert.equal(formatPickVnRating(PICK_VN_PLUS_NUMERIC), "6.0+");
});

test("snapPickVnOnboardingConfirm clamps to 1.5–4.0", () => {
  assert.equal(snapPickVnOnboardingConfirm(2.35), 2.4);
  assert.equal(snapPickVnOnboardingConfirm(4.5), 4.0);
  assert.equal(snapPickVnOnboardingConfirm(1.2), 1.5);
});

test("migrateLegacyRating keeps min 1.5", () => {
  assert.equal(migrateLegacyRating(1.5), 1.5);
  assert.equal(migrateLegacyRating(1.0), 1.5);
  assert.equal(migrateLegacyRating(4.0), 4.0);
});

test("normalizePlayer migrates legacy skillLevel fields", () => {
  const player = normalizePlayer({
    id: 1,
    name: "Test",
    skillLevel: 3.5,
    skillLevelLockedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(player.current_rating, 3.5);
  assert.equal(player.rating_status, RATING_STATUS.SELF_DECLARED);
  assert.equal(getPlayerCurrentRating(player), 3.5);
  assert.equal(getPlayerSkillLevel(player), 3.5);
});

test("saveSelfDeclaredRating without assessment still needs wizard onboarding", async () => {
  resetPickVnRatingLocalStoreForTests();
  const authUserId = "user-test-legacy";

  const result = await saveSelfDeclaredRating(authUserId, 4.0);
  assert.equal(result.ok, true);
  assert.equal(needsPickVnOnboarding(authUserId), true);
});

test("completePickVnOnboarding saves assessment and clears gate", async () => {
  resetPickVnRatingLocalStoreForTests();
  const authUserId = "user-wizard-1";

  assert.equal(needsPickVnOnboarding(authUserId), true);

  const result = await completePickVnOnboarding(authUserId, {
    answers: {
      gender: "male",
      birth_year: 1992,
      playing_duration: "2_3yr",
      sessions_per_week: "3",
      has_coach: "regular",
      tournament_level: "club_internal",
      best_result: "quarter",
      was_seed: "never",
      prior_sports: ["badminton"],
      prior_sport_level: "club",
      rally_consistency: "pct_80",
      return_stability: "pct_50",
      dink_ability: "10",
      volley_ability: "basic",
      third_shot_drop: "stable",
      reset_ability: "basic",
      play_style: "all_around",
      kitchen_frequency: "often",
      stacking_knowledge: "frequent",
      nvz_transition: "basic",
      team_coordination: "medium",
      pace_control: "basic",
      doubles_positioning: "none",
      self_rating: "3.0",
    },
  });

  assert.equal(result.ok, true);
  const record = getPickVnRatingByAuthUserId(authUserId);
  assert.equal(record.currentRating, 2.8);
  assert.equal(record.provisionalRating, 2.8);
  assert.equal(record.selfDeclaredRating, 3.0);
  assert.equal(record.ratingStatus, RATING_STATUS.PROVISIONAL);
  assert.ok(record.assessmentScore >= 46 && record.assessmentScore <= 55);
  assert.ok(record.assessmentAnswers);
  assert.equal(record.assessmentAnswers.gender, "male");
  assert.equal(record.suggestedRating != null, true);
  assert.equal(needsPickVnOnboarding(authUserId), false);
});

test("migratePlayerRatingFields builds mirror from legacy player", () => {
  const mirror = migratePlayerRatingFields({
    id: 9,
    skillLevel: 2.5,
    skillLevelLockedAt: "2026-01-01",
  });

  assert.equal(mirror.current_rating, 2.5);
  assert.equal(mirror.self_declared_rating, 2.5);
  assert.equal(mirror.rating_status, RATING_STATUS.SELF_DECLARED);
});

test("parsePickVnRating handles 6.0+ label", () => {
  assert.equal(parsePickVnRating("6.0+"), PICK_VN_PLUS_NUMERIC);
});

test("incrementRatingMatchCountForClubPlayers updates mirror on club player", async () => {
  resetPickVnRatingLocalStoreForTests();
  const authUserId = "user-match-count-1";
  await saveSelfDeclaredRating(authUserId, 3.5);

  setActiveClubId(DEFAULT_CLUB.id);
  saveClubData(DEFAULT_CLUB.id, {
    ...loadClubData(DEFAULT_CLUB.id),
    players: [
      {
        id: "p1",
        name: "Match Player",
        authUserId,
        skillLevel: 3.5,
        level: 3.5,
        rating_status: RATING_STATUS.SELF_DECLARED,
      },
    ],
  });

  const result = incrementRatingMatchCountForClubPlayers(DEFAULT_CLUB.id, ["p1"]);
  assert.equal(result.ok, true);
  assert.equal(result.count, 1);

  const record = getPickVnRatingByAuthUserId(authUserId);
  assert.equal(record.ratingMatchCount, 1);

  const data = loadClubData(DEFAULT_CLUB.id);
  assert.equal(data.players[0].rating_match_count, 1);
});
