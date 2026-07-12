import { V5_MIN_RATING, V5_MAX_RATING, clampRatingMean, toDisplayRating } from "../constants/ratingScale.js";
import { getDomainWeights } from "../constants/domainWeights.js";
import { RATING_MODE } from "../constants/ratingModes.js";
import { V5_RATING_STATUS } from "../constants/ratingStatus.js";
import { V5_VERSION_BUNDLE } from "../constants/versions.js";
import { formatDomainList, formatRatingTerm } from "../constants/terminology.js";
import { CORE_QUESTIONS, getCoreQuestionById } from "./coreQuestions.js";
import { ADAPTIVE_QUESTIONS, ADAPTIVE_ROUTE } from "./adaptiveQuestionBank.js";
import { applyCriticalGates } from "./criticalGates.js";

const ANCHOR_MIN = 0;
const ANCHOR_MAX = 7;

/** Map behavioral anchor 0–7 → internal skill mean (no per-question rounding). */
export function anchorToSkillMean(anchor) {
  const value = Math.max(ANCHOR_MIN, Math.min(ANCHOR_MAX, Number(anchor) || 0));
  const span = V5_MAX_RATING - V5_MIN_RATING;
  return V5_MIN_RATING + (value / ANCHOR_MAX) * span;
}

export function getAllQuestions() {
  return [...CORE_QUESTIONS, ...ADAPTIVE_QUESTIONS];
}

export function getQuestionById(id) {
  return getCoreQuestionById(id) ?? ADAPTIVE_QUESTIONS.find((q) => q.id === id) ?? null;
}

function accumulateDomainScores(answers) {
  const domainSums = {};
  const domainCounts = {};

  for (const [questionId, anchor] of Object.entries(answers)) {
    const question = getQuestionById(questionId);
    if (!question) continue;
    const skill = anchorToSkillMean(anchor);
    const domains = [question.domain, ...(question.secondaryDomains ?? [])];
    for (const domain of domains) {
      domainSums[domain] = (domainSums[domain] ?? 0) + skill;
      domainCounts[domain] = (domainCounts[domain] ?? 0) + 1;
    }
  }

  const domainScores = {};
  for (const [domain, sum] of Object.entries(domainSums)) {
    domainScores[domain] = sum / domainCounts[domain];
  }
  return domainScores;
}

export function buildSkillVector(domainScores, ratingMode = RATING_MODE.DOUBLES) {
  const weights = getDomainWeights(ratingMode);
  const vector = {};
  for (const domain of Object.keys(weights)) {
    vector[domain] = domainScores[domain] ?? null;
  }
  return vector;
}

export function computeWeightedMean(skillVector, ratingMode = RATING_MODE.DOUBLES) {
  const weights = getDomainWeights(ratingMode);
  let sum = 0;
  let weightSum = 0;
  for (const [domain, weight] of Object.entries(weights)) {
    const value = Number(skillVector[domain]);
    if (!Number.isFinite(value)) continue;
    sum += value * weight;
    weightSum += weight;
  }
  if (weightSum <= 0) return V5_MIN_RATING;
  return clampRatingMean(sum / weightSum);
}

function detectContradictions(answers) {
  const flags = [];
  for (const question of ADAPTIVE_QUESTIONS) {
    if (question.route !== ADAPTIVE_ROUTE.CONSISTENCY_CHECK) continue;
    if (answers[question.id] == null) continue;
    const check = Number(answers[question.id]);
    if (check <= 2) {
      flags.push({
        type: "CONTRADICTION",
        questionId: question.id,
        related: question.checksContradiction ?? [],
      });
    }
  }
  return flags;
}

export function scoreAssessment(answers, options = {}) {
  const ratingMode = options.ratingMode ?? RATING_MODE.DOUBLES;
  const domainScores = accumulateDomainScores(answers);
  const skillVector = buildSkillVector(domainScores, ratingMode);
  const ratingBeforeGates = computeWeightedMean(skillVector, ratingMode);
  const warningFlags = detectContradictions(answers);
  const gateResult = applyCriticalGates(ratingBeforeGates, domainScores, {
    hasContradiction: warningFlags.length > 0,
  });

  const answeredCount = Object.keys(answers).length;
  const coverage = answeredCount / Math.max(1, CORE_QUESTIONS.length);
  const initialDeviation = clampDeviation(0.55 - coverage * 0.15 + warningFlags.length * 0.05);
  const confidenceScore = Math.round(Math.max(10, Math.min(85, coverage * 70 - warningFlags.length * 10)));
  const estimatedError = clampRatingMean(initialDeviation * 0.85, 0.35);

  let ratingStatus = V5_RATING_STATUS.SELF_ASSESSED;
  if (gateResult.statusOverride) {
    ratingStatus = gateResult.statusOverride;
  } else if (warningFlags.length) {
    ratingStatus = V5_RATING_STATUS.UNDER_REVIEW;
  }

  const strengths = topSkills(domainScores, 2, "high");
  const limits = topSkills(domainScores, 2, "low");

  return {
    initialMean: gateResult.ratingAfterGates,
    initialDeviation,
    skillVector,
    domainScores,
    overallSkill: gateResult.ratingAfterGates,
    estimatedRating: gateResult.ratingBeforeGates,
    provisionalRating: gateResult.ratingAfterGates,
    provisionalDisplayRating: Math.min(toDisplayRating(gateResult.ratingAfterGates), 4.5),
    confidenceScore,
    estimatedError,
    estimatedRange: {
      low: clampRatingMean(gateResult.ratingAfterGates - estimatedError),
      high: clampRatingMean(gateResult.ratingAfterGates + estimatedError),
    },
    warningFlags,
    appliedGates: gateResult.appliedGates,
    limitingSkills: gateResult.limitingSkills,
    ratingBeforeGates: gateResult.ratingBeforeGates,
    ratingAfterGates: gateResult.ratingAfterGates,
    verificationRequired: gateResult.verificationRequired,
    ratingStatus,
    strengths,
    limits,
    assessmentVersion: V5_VERSION_BUNDLE.assessmentVersion,
    questionBankVersion: V5_VERSION_BUNDLE.questionBankVersion,
    versions: { ...V5_VERSION_BUNDLE },
    explanation: buildExplanation(gateResult.ratingAfterGates, strengths, limits),
    explanationDisplay: buildExplanationDisplay(gateResult.ratingAfterGates, strengths, limits, warningFlags),
  };
}

function clampDeviation(value) {
  return Math.max(0.18, Math.min(0.75, Number(value) || 0.48));
}

function topSkills(domainScores, n, direction) {
  const entries = Object.entries(domainScores).filter(([, v]) => Number.isFinite(v));
  entries.sort((a, b) => (direction === "high" ? b[1] - a[1] : a[1] - b[1]));
  return entries.slice(0, n).map(([domain]) => domain);
}

function buildExplanation(rating, strengths, limits) {
  return {
    summary: `Rating tổng: ${rating.toFixed(3)}`,
    strengths: `Kỹ năng mạnh: ${strengths.join(", ") || "—"}`,
    limits: `Kỹ năng giới hạn: ${limits.join(", ") || "—"}`,
  };
}

function buildExplanationDisplay(rating, strengths, limits, warningFlags) {
  const provisionalLabel = formatRatingTerm("provisional_rating");
  return {
    summary: `${provisionalLabel}: ${rating.toFixed(1)}`,
    strengths: `Kỹ năng mạnh: ${formatDomainList(strengths)}`,
    limits: `Kỹ năng giới hạn: ${formatDomainList(limits)}`,
    warnings: warningFlags.map(() => formatRatingTerm("contradiction")),
  };
}
