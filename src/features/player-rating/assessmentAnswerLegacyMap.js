/**
 * Map answer IDs from Assessment V1 → V2 for backward-compatible rescoring.
 * Only applied at calculation time — stored answers are not mutated.
 */
export const ASSESSMENT_VERSION = "v2";

const LEGACY_ANSWER_MAP = Object.freeze({
  playing_duration: Object.freeze({
    "1_3yr": "2_3yr",
  }),
  sessions_per_week: Object.freeze({
    "4plus": "4",
  }),
  has_coach: Object.freeze({
    no: "never",
    yes: "regular",
  }),
  was_seed: Object.freeze({
    no: "never",
    yes: "once",
  }),
  rally_consistency: Object.freeze({
    no: "none",
  }),
  return_stability: Object.freeze({
    no: "none",
  }),
  dink_ability: Object.freeze({
    no: "none",
  }),
  third_shot_drop: Object.freeze({
    unstable: "attempted",
  }),
  kitchen_frequency: Object.freeze({
    sometimes: "weekly",
  }),
  stacking_knowledge: Object.freeze({
    know: "frequent",
  }),
  team_coordination: Object.freeze({
    low: "very_low",
  }),
});

function remapAnswerValue(questionId, value, questionMap) {
  if (value == null || value === "") {
    return value;
  }

  if (questionId === "prior_sports" && Array.isArray(value)) {
    return value;
  }

  const mapped = questionMap?.[String(value)];
  return mapped ?? value;
}

export function normalizeLegacyAnswers(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const next = { ...raw };

  for (const [questionId, questionMap] of Object.entries(LEGACY_ANSWER_MAP)) {
    if (!(questionId in next)) {
      continue;
    }
    next[questionId] = remapAnswerValue(questionId, next[questionId], questionMap);
  }

  return next;
}
