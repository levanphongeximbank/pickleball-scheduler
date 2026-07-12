import { CORE_QUESTIONS } from "./coreQuestions.js";
import {
  ADAPTIVE_QUESTIONS,
  ADAPTIVE_ROUTE,
  MAX_ADAPTIVE_QUESTIONS,
} from "./adaptiveQuestionBank.js";

/**
 * Chọn câu thích ứng giảm uncertainty — không phải thứ tự cố định.
 * Pilot sẽ thay heuristic bằng information-gain model.
 */
export function selectNextAdaptiveQuestion(state = {}) {
  const {
    answers = {},
    askedIds = [],
    contradictionDetected = false,
  } = state;

  const asked = new Set(askedIds);
  const adaptiveAsked = askedIds.filter((id) => id.startsWith("adp_")).length;
  if (adaptiveAsked >= MAX_ADAPTIVE_QUESTIONS) {
    return null;
  }

  if (contradictionDetected) {
    const check = pickBestUncertainty(ADAPTIVE_QUESTIONS, asked, ADAPTIVE_ROUTE.CONSISTENCY_CHECK, answers);
    if (check) return check;
  }

  const recentAnchors = getRecentAnchors(answers, 3);
  const avgAnchor = average(recentAnchors);

  let route = ADAPTIVE_ROUTE.MEDIUM;
  if (avgAnchor <= 2) route = ADAPTIVE_ROUTE.FOUNDATION;
  else if (avgAnchor >= 5) route = ADAPTIVE_ROUTE.ADVANCED;

  const candidate = pickBestUncertainty(ADAPTIVE_QUESTIONS, asked, route, answers);
  if (candidate) return candidate;

  return pickBestUncertainty(ADAPTIVE_QUESTIONS, asked, null, answers);
}

export function buildAssessmentPlan() {
  return {
    coreQuestionIds: CORE_QUESTIONS.map((q) => q.id),
    maxAdaptiveQuestions: MAX_ADAPTIVE_QUESTIONS,
    expectedQuestionCount: { min: 24, max: 30, typical: "24–26" },
  };
}

function getRecentAnchors(answers, count) {
  const entries = Object.entries(answers);
  return entries.slice(-count).map(([, v]) => Number(v)).filter(Number.isFinite);
}

function average(values) {
  if (!values.length) return 3;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pickBestUncertainty(pool, asked, route, answers) {
  const domainCoverage = buildDomainCoverage(answers);
  const candidates = pool.filter((q) => {
    if (asked.has(q.id)) return false;
    if (route && q.route !== route) return false;
    return true;
  });

  let best = null;
  let bestScore = -Infinity;
  for (const question of candidates) {
    const coverage = domainCoverage[question.domain] ?? 0;
    const uncertainty = 1 - Math.min(1, coverage / 2);
    const routeBoost = question.route === ADAPTIVE_ROUTE.CONSISTENCY_CHECK ? 0.5 : 0;
    const score = uncertainty + routeBoost;
    if (score > bestScore) {
      bestScore = score;
      best = question;
    }
  }
  return best;
}

function buildDomainCoverage(answers) {
  const coverage = {};
  for (const [questionId] of Object.entries(answers)) {
    const fromCore = CORE_QUESTIONS.find((q) => q.id === questionId);
    const fromAdp = ADAPTIVE_QUESTIONS.find((q) => q.id === questionId);
    const q = fromCore ?? fromAdp;
    if (!q) continue;
    coverage[q.domain] = (coverage[q.domain] ?? 0) + 1;
  }
  return coverage;
}
