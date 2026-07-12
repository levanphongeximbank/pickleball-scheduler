/**
 * V5-B.0 benchmark personas — doubles assessment only.
 * Singles personas are spec-only (V5-B.1).
 */
import { CORE_QUESTIONS } from "../assessment/coreQuestions.js";
import { scoreAssessment } from "../assessment/assessmentScoringEngine.js";
import { selectNextAdaptiveQuestion } from "../assessment/adaptiveRouting.js";
import { toDisplayRating } from "../constants/ratingScale.js";
import { RATING_MODE } from "../constants/ratingModes.js";

export function buildCoreAnswers(overrides = {}, defaultAnchor = 3) {
  const answers = {};
  for (const question of CORE_QUESTIONS) {
    answers[question.id] = overrides[question.id] ?? overrides[question.domain] ?? defaultAnchor;
  }
  return answers;
}

export function simulateAdaptiveSession(coreAnswers, { contradictionDetected = false } = {}) {
  const answers = { ...coreAnswers };
  const askedIds = Object.keys(coreAnswers);
  const adaptiveSelected = [];
  const anchors = Object.values(coreAnswers).filter(Number.isFinite);
  const avgAnchor = anchors.length
    ? anchors.reduce((a, b) => a + b, 0) / anchors.length
    : 3;

  let maxAdaptive;
  if (avgAnchor <= 2) maxAdaptive = contradictionDetected ? 4 : 2;
  else if (avgAnchor <= 4) maxAdaptive = 4;
  else maxAdaptive = 8;

  const maxTotal = contradictionDetected ? 30 : 26;
  const adaptiveBudget = Math.min(maxAdaptive, Math.max(0, maxTotal - askedIds.length));

  for (let i = 0; i < adaptiveBudget; i += 1) {
    const next = selectNextAdaptiveQuestion({
      answers,
      askedIds,
      contradictionDetected,
    });
    if (!next) break;
    askedIds.push(next.id);
    adaptiveSelected.push(next.id);
    answers[next.id] = answers[next.domain] ?? Math.round(avgAnchor);
  }

  return { answers, adaptiveSelected, totalQuestions: Object.keys(answers).length };
}

export function runPersonaBenchmark(persona) {
  const session = simulateAdaptiveSession(persona.coreAnswers, {
    contradictionDetected: persona.contradictionDetected ?? false,
  });
  const scored = scoreAssessment(session.answers, { ratingMode: RATING_MODE.DOUBLES });

  return {
    id: persona.id,
    label: persona.label,
    domain_scores: scored.domainScores,
    overall_skill: scored.overallSkill,
    rating_before_gates: scored.ratingBeforeGates,
    rating_after_gates: scored.ratingAfterGates,
    estimated_rating: scored.ratingBeforeGates,
    provisional_display_rating: toDisplayRating(scored.ratingAfterGates),
    confidence: scored.confidenceScore,
    estimated_error: scored.estimatedError,
    limiting_skills: scored.limitingSkills,
    applied_gates: scored.appliedGates,
    contradiction_flags: scored.warningFlags,
    adaptive_questions_selected: session.adaptiveSelected,
    total_questions_answered: session.totalQuestions,
    verification_required: scored.verificationRequired,
    rating_status: scored.ratingStatus,
    verified_rating_created: false,
  };
}

/** 30 benchmark personas — anchor 0–7 per domain override */
export const BENCHMARK_PERSONAS = [
  { id: "p01_brand_new", label: "Người mới hoàn toàn", coreAnswers: buildCoreAnswers({}, 0) },
  { id: "p02_never_played", label: "Biết môn nhưng chưa chơi", coreAnswers: buildCoreAnswers({}, 1) },
  { id: "p03_tennis_new_pb", label: "Tennis mạnh, mới pickleball", coreAnswers: buildCoreAnswers({ groundstroke: 5, serve: 4, return: 4, dink_soft_game: 1, transition: 1, doubles_positioning: 2 }, 2) },
  { id: "p04_badminton_bg", label: "Cầu lông, học pickleball", coreAnswers: buildCoreAnswers({ groundstroke: 4, dink_soft_game: 3, volley: 4, footwork: 4 }, 3) },
  { id: "p05_drive_strong_dink_weak", label: "Drive mạnh, dink yếu", coreAnswers: buildCoreAnswers({ groundstroke: 6, rally_consistency: 5, dink_soft_game: 1, transition: 2, block_reset: 2, doubles_positioning: 3 }, 5) },
  { id: "p06_dink_good_transition_weak", label: "Dink tốt, transition yếu", coreAnswers: buildCoreAnswers({ dink_soft_game: 6, error_control: 5, transition: 1, third_shot: 3, groundstroke: 4 }, 4) },
  { id: "p07_tech_good_position_weak", label: "Kỹ thuật tốt, positioning yếu", coreAnswers: buildCoreAnswers({ groundstroke: 5, volley: 5, dink_soft_game: 5, doubles_positioning: 1, communication: 2 }, 4) },
  { id: "p08_tactics_high_rules_low", label: "Chiến thuật khai cao, luật thấp", coreAnswers: buildCoreAnswers({ tactical_decision: 6, pressure_execution: 5, rules: 1 }, 4) },
  { id: "p09_balanced_30", label: "Cân bằng ~3.0", coreAnswers: buildCoreAnswers({}, 3) },
  { id: "p10_balanced_35", label: "Cân bằng ~3.5", coreAnswers: buildCoreAnswers({}, 4) },
  { id: "p11_balanced_40", label: "Cân bằng ~4.0", coreAnswers: buildCoreAnswers({ pressure_execution: 5 }, 5) },
  { id: "p12_all_high", label: "Tất cả đáp án cao", coreAnswers: buildCoreAnswers({}, 7) },
  { id: "p13_expected_above_45", label: "Dự kiến trên 4.5", coreAnswers: buildCoreAnswers({ pressure_execution: 6 }, 6) },
  { id: "p14_sandbagger", label: "Kỹ thuật cao, khai thấp exp", coreAnswers: buildCoreAnswers({ consistency: 1, groundstroke: 6, dink_soft_game: 6 }, 5), contradictionDetected: true },
  { id: "p15_soft_game_specialist", label: "Chuyên soft game", coreAnswers: buildCoreAnswers({ dink_soft_game: 7, groundstroke: 3, volley: 4 }, 5) },
  { id: "p16_baseline_banger", label: "Baseline banger", coreAnswers: buildCoreAnswers({ groundstroke: 7, rally_consistency: 6, dink_soft_game: 2, transition: 2 }, 5) },
  { id: "p17_net_player", label: "Net/volley player", coreAnswers: buildCoreAnswers({ volley: 6, block_reset: 6, dink_soft_game: 5, groundstroke: 3 }, 5) },
  { id: "p18_weak_serve_strong_return", label: "Giao yếu, return mạnh", coreAnswers: buildCoreAnswers({ serve: 2, return: 6 }, 4) },
  { id: "p19_strong_serve_weak_return", label: "Giao mạnh, return yếu", coreAnswers: buildCoreAnswers({ serve: 6, return: 2 }, 4) },
  { id: "p20_communication_weak", label: "Đánh tốt, giao tiếp kém", coreAnswers: buildCoreAnswers({ communication: 1, doubles_positioning: 2, groundstroke: 5, dink_soft_game: 5 }, 5) },
  { id: "p21_third_shot_weak", label: "Third-shot yếu", coreAnswers: buildCoreAnswers({ third_shot: 1, transition: 2, groundstroke: 5, return: 5 }, 4) },
  { id: "p22_error_prone", label: "Lỗi không ép buộc nhiều", coreAnswers: buildCoreAnswers({ error_control: 1, rally_consistency: 2 }, 3) },
  { id: "p23_rules_solid_mid", label: "Luật tốt, kỹ thuật TB", coreAnswers: buildCoreAnswers({ rules: 6 }, 3) },
  { id: "p24_pressure_collapse", label: "Áp lực điểm yếu", coreAnswers: buildCoreAnswers({ pressure_execution: 1 }, 5) },
  { id: "p25_club_regular", label: "Chơi CLB đều", coreAnswers: buildCoreAnswers({ consistency: 5 }, 4) },
  { id: "p26_recreational_25", label: "Giải trí ~2.5", coreAnswers: buildCoreAnswers({}, 2) },
  { id: "p27_intermediate_45_gate", label: "Gần 4.5 nhưng thiếu dink", coreAnswers: buildCoreAnswers({ dink_soft_game: 2, groundstroke: 6, serve: 6, return: 6, transition: 5, block_reset: 5, doubles_positioning: 5, consistency: 5, pressure_execution: 5 }, 5) },
  { id: "p28_well_rounded_40", label: "Toàn diện 4.0", coreAnswers: buildCoreAnswers({ pressure_execution: 5 }, 5) },
  { id: "p29_almost_advanced", label: "Gần advanced", coreAnswers: buildCoreAnswers({}, 6) },
  { id: "p30_contradiction_check", label: "Mâu thuẫn exp vs rally", coreAnswers: buildCoreAnswers({ consistency: 7 }, 2), contradictionDetected: true },
];

export function runAllPersonaBenchmarks() {
  return BENCHMARK_PERSONAS.map(runPersonaBenchmark);
}

export function validateBenchmarkResults(results) {
  const issues = [];
  const sorted = [...results].sort((a, b) => a.rating_after_gates - b.rating_after_gates);

  for (const r of results) {
    if (r.rating_after_gates < 1.5) issues.push(`${r.id}: below minimum 1.5`);
    if (r.provisional_display_rating > 4.5 && !r.verification_required) {
      issues.push(`${r.id}: above 4.5 without verification_required`);
    }
    if (r.rating_status === "verified") issues.push(`${r.id}: questionnaire created verified status`);
    if (r.total_questions_answered > 30) issues.push(`${r.id}: exceeded 30 questions`);
    if (r.id === "p01_brand_new" && r.total_questions_answered > 24 && !r.contradiction_flags.length) {
      issues.push(`${r.id}: beginner answered ${r.total_questions_answered} without contradiction`);
    }
  }

  if (sorted[0].id !== "p01_brand_new" && sorted[0].rating_after_gates > sorted[sorted.length - 1].rating_after_gates) {
    issues.push("monotonicity: lowest persona not p01");
  }
  if (results.find((r) => r.id === "p12_all_high")?.provisional_display_rating > 4.5) {
    const allHigh = results.find((r) => r.id === "p12_all_high");
    if (!allHigh.verification_required) issues.push("p12: all high should require verification");
  }

  return { ok: issues.length === 0, issues, count: results.length };
}
