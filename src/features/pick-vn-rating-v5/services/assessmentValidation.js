import { CORE_QUESTIONS, getCoreQuestionIds } from "../assessment/coreQuestions.js";
import { ADAPTIVE_QUESTIONS, MAX_ADAPTIVE_QUESTIONS } from "../assessment/adaptiveQuestionBank.js";
import { getQuestionById } from "../assessment/assessmentScoringEngine.js";
import { normalizeDomainCode, DOMAIN_CODE_ALIASES } from "../constants/domainCodes.js";
import { V5_VERSION_BUNDLE } from "../constants/versions.js";
import { RATING_MODE } from "../constants/ratingModes.js";

const ANCHOR_MIN = 0;
const ANCHOR_MAX = 7;

export function getActiveVersionContract() {
  return { ...V5_VERSION_BUNDLE };
}

export function validateAnswerAnchors(answers) {
  const issues = [];
  for (const [questionId, anchor] of Object.entries(answers)) {
    const question = getQuestionById(questionId);
    if (!question) {
      issues.push(`unknown question: ${questionId}`);
      continue;
    }
    const value = Number(anchor);
    if (!Number.isInteger(value) || value < ANCHOR_MIN || value > ANCHOR_MAX) {
      issues.push(`invalid anchor for ${questionId}: ${anchor}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateQuestionIds(answers) {
  const issues = [];
  for (const questionId of Object.keys(answers)) {
    if (!getQuestionById(questionId)) {
      issues.push(`invalid question id: ${questionId}`);
    }
    if (DOMAIN_CODE_ALIASES[questionId]) {
      issues.push(`alias used as question id: ${questionId}`);
    }
    if (normalizeDomainCode(questionId) && !questionId.startsWith("core_") && !questionId.startsWith("adp_")) {
      issues.push(`domain code used as question id: ${questionId}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateCoreCoverage(answers) {
  const missing = getCoreQuestionIds().filter((id) => answers[id] == null);
  return { ok: missing.length === 0, missing };
}

export function validateAdaptiveBudget(answers) {
  const adaptiveCount = Object.keys(answers).filter((id) => id.startsWith("adp_")).length;
  if (adaptiveCount > MAX_ADAPTIVE_QUESTIONS) {
    return { ok: false, code: "ADAPTIVE_BUDGET_EXCEEDED", adaptiveCount, max: MAX_ADAPTIVE_QUESTIONS };
  }
  return { ok: true, adaptiveCount, max: MAX_ADAPTIVE_QUESTIONS };
}

export function validateAssessmentOwnership(assessment, userId) {
  if (!assessment) return { ok: false, code: "ASSESSMENT_NOT_FOUND" };
  if (assessment.player_id !== userId) return { ok: false, code: "FORBIDDEN_OWNER" };
  return { ok: true };
}

export function validateAssessmentDraft(assessment) {
  if (!assessment) return { ok: false, code: "ASSESSMENT_NOT_FOUND" };
  if (assessment.assessment_status === "completed") {
    return { ok: false, code: "ALREADY_COMPLETED", completed: true };
  }
  if (assessment.assessment_status !== "draft") {
    return { ok: false, code: "INVALID_STATUS", status: assessment.assessment_status };
  }
  return { ok: true };
}

export function validateTenantMatch(assessment, tenantId) {
  if (!assessment || !tenantId) return { ok: false, code: "TENANT_MISMATCH" };
  if (assessment.tenant_id !== tenantId) return { ok: false, code: "TENANT_MISMATCH" };
  return { ok: true };
}

export function validateRatingMode(ratingMode) {
  if (ratingMode === RATING_MODE.SINGLES) {
    return { ok: false, code: "SINGLES_NOT_IMPLEMENTED", message: "V5-B.1" };
  }
  if (ratingMode !== RATING_MODE.DOUBLES) {
    return { ok: false, code: "INVALID_MODE" };
  }
  return { ok: true };
}

export function validateClientVersionIgnored(clientVersion) {
  const active = getActiveVersionContract();
  if (clientVersion && clientVersion !== active.assessmentVersion) {
    return { ok: true, code: "CLIENT_VERSION_IGNORED", activeVersion: active.assessmentVersion };
  }
  return { ok: true, code: "OK" };
}

export function validateAnswersForCompletion(answers) {
  const questionCheck = validateQuestionIds(answers);
  if (!questionCheck.ok) return { ok: false, code: "INVALID_QUESTION_ID", issues: questionCheck.issues };

  const anchorCheck = validateAnswerAnchors(answers);
  if (!anchorCheck.ok) return { ok: false, code: "INVALID_ANSWER_ANCHOR", issues: anchorCheck.issues };

  const coreCheck = validateCoreCoverage(answers);
  if (!coreCheck.ok) return { ok: false, code: "MISSING_CORE_QUESTIONS", missing: coreCheck.missing };

  const adaptiveCheck = validateAdaptiveBudget(answers);
  if (!adaptiveCheck.ok) return adaptiveCheck;

  return { ok: true };
}

export function listAllQuestionIds() {
  return [...CORE_QUESTIONS.map((q) => q.id), ...ADAPTIVE_QUESTIONS.map((q) => q.id)];
}
