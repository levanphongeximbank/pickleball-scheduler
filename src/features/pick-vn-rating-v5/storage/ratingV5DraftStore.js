import { ASSESSMENT_VERSION, QUESTION_BANK_VERSION } from "../constants/versions.js";

const DRAFT_STORAGE_KEY = "pickleball-rating-v5-assessment-draft-v1";

const FORBIDDEN_DRAFT_FIELDS = new Set([
  "rating",
  "domain_scores",
  "estimated_rating",
  "verified_rating",
  "reliability_score",
  "evidence_level",
  "provisional_rating",
  "confidence_score",
]);

export function createEmptyDraft() {
  return {
    assessment_id: null,
    answers: {},
    current_step: 0,
    answered_question_ids: [],
    adaptive_question_ids: [],
    question_order: [],
    started_at: null,
    assessment_version: ASSESSMENT_VERSION,
    question_bank_version: QUESTION_BANK_VERSION,
  };
}

export function sanitizeDraftForStorage(draft) {
  const safe = createEmptyDraft();
  if (!draft || typeof draft !== "object") return safe;

  safe.assessment_id = draft.assessment_id ?? draft.assessmentId ?? null;
  safe.answers = { ...(draft.answers ?? {}) };
  safe.current_step = Number(draft.current_step ?? draft.currentStep ?? 0) || 0;
  safe.answered_question_ids = [...(draft.answered_question_ids ?? draft.answeredQuestionIds ?? [])];
  safe.adaptive_question_ids = [...(draft.adaptive_question_ids ?? draft.adaptiveQuestionIds ?? [])];
  safe.question_order = [...(draft.question_order ?? draft.questionOrder ?? [])];
  safe.started_at = draft.started_at ?? draft.startedAt ?? null;
  safe.assessment_version = draft.assessment_version ?? draft.assessmentVersion ?? ASSESSMENT_VERSION;
  safe.question_bank_version = draft.question_bank_version ?? draft.questionBankVersion ?? QUESTION_BANK_VERSION;

  for (const field of FORBIDDEN_DRAFT_FIELDS) {
    if (field in safe) delete safe[field];
  }
  return safe;
}

export function loadRatingV5Draft() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeDraftForStorage(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveRatingV5Draft(draft) {
  if (typeof localStorage === "undefined") return;
  const safe = sanitizeDraftForStorage(draft);
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(safe));
}

export function clearRatingV5Draft() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function isDraftVersionMismatch(draft) {
  if (!draft) return false;
  return (
    draft.assessment_version !== ASSESSMENT_VERSION
    || draft.question_bank_version !== QUESTION_BANK_VERSION
  );
}

export function __resetRatingV5DraftStoreForTests() {
  clearRatingV5Draft();
}
