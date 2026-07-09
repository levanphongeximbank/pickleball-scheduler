import test from "node:test";
import assert from "node:assert/strict";

import { WARNING_FLAGS } from "../src/features/player-rating/playerSkillAssessmentConfig.js";
import {
  calculatePlayerAssessment,
  calculateProfileScore,
  calculateTournamentScore,
  calculateSportBackgroundScore,
  calculateTechnicalScore,
  calculateTacticalScore,
  calculateSelfDeclaredScore,
  mapScoreToRating,
  applyProvisionalRatingCalibration,
  detectRatingConflicts,
  validateAssessmentStep,
  normalizeLegacyAnswers,
} from "../src/features/player-rating/playerSkillAssessmentEngine.js";
import { PROVISIONAL_RATING_CALIBRATION } from "../src/features/player-rating/playerSkillAssessmentConfig.js";
import { RATING_STATUS } from "../src/features/pick-vn-rating/constants/ratingStatus.js";

export function baseAnswers(overrides = {}) {
  return {
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
    ...overrides,
  };
}

/** V1 answer IDs for legacy remap tests */
export function legacyV1Answers(overrides = {}) {
  return {
    gender: "male",
    birth_year: 1992,
    playing_duration: "1_3yr",
    sessions_per_week: "3",
    has_coach: "yes",
    tournament_level: "club_internal",
    best_result: "quarter",
    was_seed: "no",
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
    stacking_knowledge: "know",
    nvz_transition: "basic",
    team_coordination: "medium",
    pace_control: "basic",
    doubles_positioning: "none",
    self_rating: "3.0",
    ...overrides,
  };
}

test("mapScoreToRating follows 100-point bands", () => {
  assert.equal(mapScoreToRating(10), 1.5);
  assert.equal(mapScoreToRating(20), 2.0);
  assert.equal(mapScoreToRating(30), 2.5);
  assert.equal(mapScoreToRating(40), 3.0);
  assert.equal(mapScoreToRating(50), 3.5);
  assert.equal(mapScoreToRating(60), 4.0);
  assert.equal(mapScoreToRating(75), 4.5);
  assert.equal(mapScoreToRating(85), 5.0);
  assert.equal(mapScoreToRating(95), 5.5);
  assert.equal(mapScoreToRating(100), 6.0);
});

test("group scorers respect caps", () => {
  const answers = baseAnswers({
    playing_duration: "gt_3yr",
    sessions_per_week: "daily",
    has_coach: "professional",
  });
  assert.equal(calculateProfileScore(answers), 20);

  const tournament = baseAnswers({
    tournament_level: "international",
    best_result: "champion",
    was_seed: "often",
  });
  assert.equal(calculateTournamentScore(tournament), 25);

  const sport = baseAnswers({
    prior_sports: ["tennis", "badminton"],
    prior_sport_level: "pro",
  });
  assert.equal(calculateSportBackgroundScore(sport), 6);
});

test("sport background uses highest sport only", () => {
  const answers = baseAnswers({
    prior_sports: ["tennis", "table_tennis"],
    prior_sport_level: "club",
  });
  assert.equal(calculateSportBackgroundScore(answers), 4.5);
});

test("sport background gap vs none is moderate", () => {
  const none = calculateSportBackgroundScore({ prior_sports: ["none"] });
  const clubBadminton = calculateSportBackgroundScore({
    prior_sports: ["badminton"],
    prior_sport_level: "club",
  });
  const proTennis = calculateSportBackgroundScore({
    prior_sports: ["tennis"],
    prior_sport_level: "pro",
  });
  assert.equal(none, 0);
  assert.equal(clubBadminton, 3);
  assert.equal(proTennis, 6);
  assert.ok(proTennis - none <= 6);
});

test("technical and tactical scores normalize to group caps", () => {
  const answers = baseAnswers();
  const technical = calculateTechnicalScore(answers);
  const tactical = calculateTacticalScore(answers);
  assert.ok(technical > 0 && technical <= 25);
  assert.ok(tactical > 0 && tactical <= 15);
});

test("self declared score capped at 5 points", () => {
  assert.equal(calculateSelfDeclaredScore({ self_rating: "6.0plus" }), 5);
  assert.equal(calculateSelfDeclaredScore({ self_rating: "1.5" }), 0);
});

test("applyProvisionalRatingCalibration scales rating by 0.7", () => {
  assert.equal(PROVISIONAL_RATING_CALIBRATION, 0.7);
  assert.equal(applyProvisionalRatingCalibration(3.5), 2.4);
  assert.equal(applyProvisionalRatingCalibration(2.0), 1.5);
  assert.equal(applyProvisionalRatingCalibration(1.5), 1.5);
});

test("calculatePlayerAssessment returns calibrated provisional rating not self rating", () => {
  const result = calculatePlayerAssessment({ answers: baseAnswers() });
  assert.equal(result.ok, true);
  assert.equal(result.raw_provisional_rating, 3.5);
  assert.equal(result.provisional_rating, 2.4);
  assert.equal(result.self_declared_rating, 3.0);
  assert.equal(result.current_rating, result.provisional_rating);
  assert.equal(result.rating_status, RATING_STATUS.PROVISIONAL);
  assert.ok(result.assessment_score >= 46 && result.assessment_score <= 55);
  assert.ok(result.rating_confidence >= 30 && result.rating_confidence <= 100);
  assert.ok(result.strengths.length > 0);
  assert.ok(result.assessment_breakdown.profileScore > 0);
});

test("legacy V1 answers remap and score without error", () => {
  const modern = calculatePlayerAssessment({ answers: baseAnswers() });
  const legacy = calculatePlayerAssessment({ answers: legacyV1Answers() });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.assessment_score, modern.assessment_score);
  assert.equal(legacy.provisional_rating, modern.provisional_rating);
});

test("normalizeLegacyAnswers maps V1 IDs to V2", () => {
  const mapped = normalizeLegacyAnswers({
    playing_duration: "1_3yr",
    has_coach: "yes",
    was_seed: "no",
    rally_consistency: "no",
    stacking_knowledge: "know",
    kitchen_frequency: "sometimes",
  });
  assert.equal(mapped.playing_duration, "2_3yr");
  assert.equal(mapped.has_coach, "regular");
  assert.equal(mapped.was_seed, "never");
  assert.equal(mapped.rally_consistency, "none");
  assert.equal(mapped.stacking_knowledge, "frequent");
  assert.equal(mapped.kitchen_frequency, "weekly");
});

test("self rating too high triggers warnings and under_review", () => {
  const result = calculatePlayerAssessment({
    answers: baseAnswers({
      playing_duration: "lt_3mo",
      tournament_level: "none",
      best_result: "none",
      rally_consistency: "none",
      return_stability: "none",
      dink_ability: "none",
      volley_ability: "unknown",
      third_shot_drop: "unknown",
      reset_ability: "unknown",
      kitchen_frequency: "rare",
      stacking_knowledge: "none",
      nvz_transition: "none",
      team_coordination: "very_low",
      pace_control: "none",
      doubles_positioning: "none",
      self_rating: "6.0plus",
    }),
  });

  assert.equal(result.ok, true);
  assert.ok(result.provisional_rating < 4.5);
  assert.equal(result.self_declared_rating, 6.5);
  assert.ok(result.warning_flags.includes(WARNING_FLAGS.SELF_RATING_TOO_HIGH));
  assert.ok(
    result.warning_flags.includes(WARNING_FLAGS.HIGH_RATING_WITHOUT_TOURNAMENT_HISTORY)
  );
  assert.ok(
    result.warning_flags.includes(WARNING_FLAGS.HIGH_RATING_WITH_LOW_EXPERIENCE)
  );
  assert.ok(result.warning_flags.includes(WARNING_FLAGS.TECHNICAL_SCORE_CONFLICT));
  assert.equal(result.rating_status, RATING_STATUS.UNDER_REVIEW);
});

test("detectRatingConflicts flags self rating gap", () => {
  const flags = detectRatingConflicts({
    answers: baseAnswers(),
    provisionalRating: 3.0,
    selfDeclaredRating: 4.5,
    technicalScore: 10,
  });
  assert.ok(flags.includes(WARNING_FLAGS.SELF_RATING_TOO_HIGH));
});

test("validateAssessmentStep blocks incomplete steps", () => {
  const step1 = validateAssessmentStep(1, { gender: "male" });
  assert.equal(step1.ok, false);
  assert.ok(step1.missing.includes("playing_duration"));

  const step4 = validateAssessmentStep(4, baseAnswers({ return_stability: "" }));
  assert.equal(step4.ok, false);
});

test("external ratings increase confidence not final rating", () => {
  const without = calculatePlayerAssessment({ answers: baseAnswers() });
  const withDupr = calculatePlayerAssessment({
    answers: baseAnswers({ dupr_rating: "4.2" }),
  });
  assert.equal(without.provisional_rating, withDupr.provisional_rating);
  assert.ok(withDupr.rating_confidence > without.rating_confidence);
  assert.equal(withDupr.external_rating_sources.dupr, 4.2);
});
