import { snapPickVnRating } from "../pick-vn-rating/constants/pickVnRatingScale.js";
import { RATING_STATUS } from "../pick-vn-rating/constants/ratingStatus.js";
import {
  BEST_RESULT_BONUS,
  COACH_BONUS,
  GROUP_CAPS,
  GROUP_LABELS,
  PROFILE_DURATION_SCORE,
  PROVISIONAL_RATING_CALIBRATION,
  SCORE_TO_RATING_BANDS,
  SEED_BONUS,
  SELF_RATING_POINTS,
  SESSIONS_WEEKLY_BONUS,
  SPORT_BASE_SCORE,
  SPORT_LEVEL_MULTIPLIER,
  TOURNAMENT_LEVEL_SCORE,
  WARNING_FLAGS,
  getQuestionById,
  SKILL_ASSESSMENT_QUESTIONS,
} from "./playerSkillAssessmentConfig.js";
import { normalizeLegacyAnswers } from "./assessmentAnswerLegacyMap.js";

const CONTENT_STEPS = 6;

export { normalizeLegacyAnswers };

function resolveAgeBand(birthYear, referenceYear = new Date().getFullYear()) {
  const year = Number(birthYear);
  if (!Number.isFinite(year) || year < 1900 || year > referenceYear) {
    return null;
  }
  const age = referenceYear - year;
  if (age < 18) return "under_18";
  if (age <= 35) return "18_35";
  if (age <= 50) return "36_50";
  if (age <= 65) return "51_65";
  return "over_65";
}

function enrichAnswers(raw = {}) {
  const answers = { ...normalizeLegacyAnswers(raw) };
  if (answers.birth_year != null && answers.birth_year !== "") {
    const band = resolveAgeBand(answers.birth_year);
    if (band) answers.age_band = band;
  }
  return answers;
}

function getOptionScore(questionId, optionId) {
  const question = getQuestionById(questionId);
  if (!question?.options || optionId == null || optionId === "") return 0;
  const match = question.options.find((o) => o.id === optionId);
  return match ? Number(match.score) || 0 : 0;
}

function capGroup(score, groupKey) {
  return Math.min(GROUP_CAPS[groupKey] ?? score, Math.max(0, score));
}

export function calculateProfileScore(answers) {
  const duration = PROFILE_DURATION_SCORE[answers.playing_duration] ?? 0;
  const sessions = SESSIONS_WEEKLY_BONUS[answers.sessions_per_week] ?? 0;
  const coach = COACH_BONUS[answers.has_coach] ?? 0;
  return capGroup(duration + sessions + coach, "profile");
}

export function calculateTournamentScore(answers) {
  const level = TOURNAMENT_LEVEL_SCORE[answers.tournament_level] ?? 0;
  const best = BEST_RESULT_BONUS[answers.best_result] ?? 0;
  const seed = SEED_BONUS[answers.was_seed] ?? 0;
  return capGroup(level + best + seed, "tournament");
}

export function calculateSportBackgroundScore(answers) {
  const sports = Array.isArray(answers.prior_sports) ? answers.prior_sports : [];
  if (!sports.length || sports.includes("none")) {
    return 0;
  }

  const multiplier = SPORT_LEVEL_MULTIPLIER[answers.prior_sport_level] ?? 0.75;
  let best = 0;

  for (const sportId of sports) {
    const base = SPORT_BASE_SCORE[sportId] ?? 0;
    const scored = Math.min(10, base * multiplier);
    best = Math.max(best, scored);
  }

  return capGroup(best, "sport_background");
}

function scoreTechniqueRaw(answers) {
  const ids = [
    "rally_consistency",
    "return_stability",
    "dink_ability",
    "volley_ability",
    "third_shot_drop",
    "reset_ability",
    "kitchen_frequency",
  ];
  let raw = ids.reduce((sum, id) => sum + getOptionScore(id, answers[id]), 0);
  if (answers.play_style === "all_around") {
    raw += 1;
  }
  return raw;
}

function maxTechniqueRaw() {
  const ids = [
    "rally_consistency",
    "return_stability",
    "dink_ability",
    "volley_ability",
    "third_shot_drop",
    "reset_ability",
    "kitchen_frequency",
  ];
  let max = ids.reduce((sum, id) => {
    const question = getQuestionById(id);
    const top = Math.max(...(question?.options || []).map((o) => Number(o.score) || 0), 0);
    return sum + top;
  }, 0);
  max += 1;
  return max;
}

export function calculateTechnicalScore(answers) {
  const raw = scoreTechniqueRaw(answers);
  const maxRaw = maxTechniqueRaw();
  if (maxRaw <= 0) return 0;
  return capGroup((raw / maxRaw) * GROUP_CAPS.technique, "technique");
}

function scoreTacticsRaw(answers) {
  const ids = [
    "stacking_knowledge",
    "nvz_transition",
    "team_coordination",
    "pace_control",
    "doubles_positioning",
  ];
  return ids.reduce((sum, id) => sum + getOptionScore(id, answers[id]), 0);
}

function maxTacticsRaw() {
  const ids = [
    "stacking_knowledge",
    "nvz_transition",
    "team_coordination",
    "pace_control",
    "doubles_positioning",
  ];
  return ids.reduce((sum, id) => {
    const question = getQuestionById(id);
    const top = Math.max(...(question?.options || []).map((o) => Number(o.score) || 0), 0);
    return sum + top;
  }, 0);
}

export function calculateTacticalScore(answers) {
  const raw = scoreTacticsRaw(answers);
  const maxRaw = maxTacticsRaw();
  if (maxRaw <= 0) return 0;
  return capGroup((raw / maxRaw) * GROUP_CAPS.tactics, "tactics");
}

export function calculateSelfDeclaredScore(answers) {
  const key = answers.self_rating;
  const points = SELF_RATING_POINTS[key] ?? 0;
  return capGroup(points, "self");
}

export function parseSelfDeclaredRating(answers) {
  const key = answers.self_rating;
  if (!key) return null;
  if (key === "5.0plus") return 5.5;
  if (key === "6.0plus" || key === "6.0+") return 6.5;
  return snapPickVnRating(key);
}

export function mapScoreToRating(totalScore) {
  const score = Math.min(100, Math.max(0, Math.round(totalScore)));
  const band = SCORE_TO_RATING_BANDS.find((row) => score >= row.min && score <= row.max);
  return band ? band.rating : 1.5;
}

export function applyProvisionalRatingCalibration(rating) {
  const scaled = Number(rating) * PROVISIONAL_RATING_CALIBRATION;
  return snapPickVnRating(Math.max(1.5, scaled));
}

function hasExternalRating(answers) {
  const dupr = Number(answers.dupr_rating);
  const utrp = Number(answers.utrp_rating);
  return (
    (Number.isFinite(dupr) && answers.dupr_rating !== "") ||
    (Number.isFinite(utrp) && answers.utrp_rating !== "")
  );
}

export function detectRatingConflicts({
  answers,
  provisionalRating,
  selfDeclaredRating,
  technicalScore,
}) {
  const flags = [];
  const self = selfDeclaredRating ?? parseSelfDeclaredRating(answers);

  if (self != null && self - provisionalRating >= 1.0) {
    flags.push(WARNING_FLAGS.SELF_RATING_TOO_HIGH);
  }

  if (
    (answers.tournament_level === "none" || !answers.tournament_level) &&
    self != null &&
    self >= 4.5
  ) {
    flags.push(WARNING_FLAGS.HIGH_RATING_WITHOUT_TOURNAMENT_HISTORY);
  }

  if (
    (answers.playing_duration === "never" ||
      answers.playing_duration === "lt_1mo" ||
      answers.playing_duration === "lt_3mo") &&
    self != null &&
    self >= 4.0
  ) {
    flags.push(WARNING_FLAGS.HIGH_RATING_WITH_LOW_EXPERIENCE);
  }

  const technicalRatio = technicalScore / GROUP_CAPS.technique;
  if (self != null && self >= 4.0 && technicalRatio < 0.4) {
    flags.push(WARNING_FLAGS.TECHNICAL_SCORE_CONFLICT);
  }

  return flags;
}

export function calculateConfidence(input = {}, warningFlags = []) {
  let confidence = 20;

  if (input.questionnaireComplete) confidence += 20;
  if (input.hasCoach) confidence += 10;
  if (input.hasClub) confidence += 10;
  if (input.hasVideo) confidence += 10;
  if (input.hasExternalRating) confidence += 15;
  if (input.hasTournamentHistory) confidence += 10;
  if (input.hasTournamentAchievement) confidence += 10;
  if (input.matchCount >= 5) confidence += 15;
  if (input.matchCount >= 10) confidence += 25;
  if (input.matchCount >= 20) confidence += 35;
  if (input.clubVerified) confidence += 25;
  if (input.adminVerified) confidence += 35;

  if (warningFlags.length) confidence -= 10;

  return Math.min(100, Math.max(0, Math.round(confidence)));
}

const BREAKDOWN_TO_GROUP = Object.freeze({
  profileScore: "profile",
  tournamentScore: "tournament",
  sportBackgroundScore: "sport_background",
  technicalScore: "technique",
  tacticalScore: "tactics",
  selfScore: "self",
});

function buildGroupInsights(breakdown) {
  const entries = Object.entries(breakdown)
    .map(([key, score]) => {
      const groupKey = BREAKDOWN_TO_GROUP[key];
      if (!groupKey || GROUP_CAPS[groupKey] == null) return null;
      return {
        key: groupKey,
        label: GROUP_LABELS[groupKey] || groupKey,
        score,
        cap: GROUP_CAPS[groupKey],
        ratio: GROUP_CAPS[groupKey] ? score / GROUP_CAPS[groupKey] : 0,
      };
    })
    .filter(Boolean);

  const strengths = entries
    .filter((row) => row.ratio >= 0.65)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 2)
    .map((row) => row.label);

  const weaknesses = entries
    .filter((row) => row.ratio < 0.45 && row.cap > 0)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 2)
    .map((row) => row.label);

  return { strengths, weaknesses };
}

function buildExplanation({ breakdown, strengths, weaknesses, warningFlags }) {
  const lines = [];

  if (strengths.length) {
    lines.push(`Điểm mạnh: ${strengths.join(", ")}.`);
  }
  if (weaknesses.length) {
    lines.push(`Cần cải thiện: ${weaknesses.join(", ")}.`);
  }
  if (breakdown.tournamentScore < GROUP_CAPS.tournament * 0.4) {
    lines.push("Chưa có đủ dữ liệu thi đấu — rating cần CLB/BTC xác thực sau.");
  }
  if (warningFlags.length) {
    lines.push("Có cảnh báo mâu thuẫn — hồ sơ sẽ được xem xét thêm.");
  }
  if (!lines.length) {
    lines.push("Đánh giá dựa trên bảng câu hỏi — chờ xác thực sau khi thi đấu.");
  }
  lines.push(
    `Rating tạm tính đã hiệu chuẩn ×${PROVISIONAL_RATING_CALIBRATION} so với điểm bảng hỏi thô.`
  );

  return lines;
}

export function validateAssessmentStep(step, answers = {}) {
  const enriched = enrichAnswers(answers);
  const questions = SKILL_ASSESSMENT_QUESTIONS.filter((q) => q.step === step);
  const missing = [];

  for (const question of questions) {
    if (typeof question.showWhen === "function" && !question.showWhen(enriched)) {
      continue;
    }
    if (question.optional || question.metadataOnly) {
      continue;
    }
    const value = enriched[question.id];
    if (question.type === "multi") {
      if (!Array.isArray(value) || !value.length) missing.push(question.id);
      continue;
    }
    if (value == null || value === "") missing.push(question.id);
  }

  return { ok: missing.length === 0, missing };
}

export function validateAllAssessmentSteps(answers = {}) {
  const missingByStep = {};
  for (let step = 1; step <= CONTENT_STEPS; step += 1) {
    const result = validateAssessmentStep(step, answers);
    if (!result.ok) missingByStep[step] = result.missing;
  }
  return { ok: Object.keys(missingByStep).length === 0, missingByStep };
}

export function calculatePlayerAssessment(input = {}) {
  const answers = enrichAnswers(input.answers || input);
  const validation = validateAllAssessmentSteps(answers);
  if (!validation.ok) {
    return {
      ok: false,
      error: "Thiếu câu trả lời bắt buộc.",
      missingByStep: validation.missingByStep,
    };
  }

  const profileScore = calculateProfileScore(answers);
  const tournamentScore = calculateTournamentScore(answers);
  const sportBackgroundScore = calculateSportBackgroundScore(answers);
  const technicalScore = calculateTechnicalScore(answers);
  const tacticalScore = calculateTacticalScore(answers);
  const selfScore = calculateSelfDeclaredScore(answers);

  const assessmentScore = Math.round(
    profileScore +
      tournamentScore +
      sportBackgroundScore +
      technicalScore +
      tacticalScore +
      selfScore
  );

  const rawProvisionalRating = snapPickVnRating(mapScoreToRating(assessmentScore));
  const provisionalRating = applyProvisionalRatingCalibration(rawProvisionalRating);
  const selfDeclaredRating = parseSelfDeclaredRating(answers);

  const warningFlags = detectRatingConflicts({
    answers,
    provisionalRating,
    selfDeclaredRating,
    technicalScore,
  });

  const externalRatingSources = {};
  if (answers.dupr_rating) externalRatingSources.dupr = Number(answers.dupr_rating);
  if (answers.utrp_rating) externalRatingSources.utrp = Number(answers.utrp_rating);

  const ratingConfidence = calculateConfidence(
    {
      questionnaireComplete: true,
      hasCoach: ["regular", "professional", "yes"].includes(answers.has_coach),
      hasClub: Boolean(input.hasClub),
      hasVideo: Boolean(input.hasVideo),
      hasExternalRating: hasExternalRating(answers),
      hasTournamentHistory: answers.tournament_level && answers.tournament_level !== "none",
      hasTournamentAchievement: answers.best_result && answers.best_result !== "none",
      matchCount: Number(input.matchCount) || 0,
      clubVerified: false,
      adminVerified: false,
    },
    warningFlags
  );

  const ratingStatus =
    warningFlags.length > 0 ? RATING_STATUS.UNDER_REVIEW : RATING_STATUS.PROVISIONAL;

  const assessmentBreakdown = {
    profileScore: Math.round(profileScore * 10) / 10,
    tournamentScore: Math.round(tournamentScore * 10) / 10,
    sportBackgroundScore: Math.round(sportBackgroundScore * 10) / 10,
    technicalScore: Math.round(technicalScore * 10) / 10,
    tacticalScore: Math.round(tacticalScore * 10) / 10,
    selfScore: Math.round(selfScore * 10) / 10,
  };

  const { strengths, weaknesses } = buildGroupInsights(assessmentBreakdown);
  const explanation = buildExplanation({
    breakdown: assessmentBreakdown,
    strengths,
    weaknesses,
    warningFlags,
  });

  return {
    ok: true,
    answers,
    assessment_score: assessmentScore,
    raw_provisional_rating: rawProvisionalRating,
    provisional_rating: provisionalRating,
    rating_calibration: PROVISIONAL_RATING_CALIBRATION,
    current_rating: provisionalRating,
    self_declared_rating: selfDeclaredRating,
    rating_confidence: ratingConfidence,
    rating_confidence_normalized: ratingConfidence / 100,
    rating_status: ratingStatus,
    warning_flags: warningFlags,
    external_rating_sources: externalRatingSources,
    assessment_breakdown: assessmentBreakdown,
    strengths,
    weaknesses,
    explanation,
  };
}
