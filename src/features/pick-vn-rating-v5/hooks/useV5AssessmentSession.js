import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getQuestionById } from "../assessment/assessmentScoringEngine.js";
import { selectNextAdaptiveQuestion } from "../assessment/adaptiveRouting.js";
import { MAX_ADAPTIVE_QUESTIONS } from "../assessment/adaptiveQuestionBank.js";
import { CORE_QUESTION_COUNT, CORE_QUESTION_ORDER } from "../constants/assessmentUiGroups.js";
import { RATING_MODE } from "../constants/ratingModes.js";
import { resolveAssessmentErrorMessage } from "../constants/assessmentErrorMessages.js";
import { getRatingV5EdgeBaseUrl } from "../config/flags.js";
import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import {
  clearRatingV5Draft,
  isDraftVersionMismatch,
  loadRatingV5Draft,
  saveRatingV5Draft,
} from "../storage/ratingV5DraftStore.js";
import { completeRatingV5Assessment } from "../services/ratingV5EdgeClient.js";
import { rpcRatingV5StartAssessment } from "../services/ratingV5RpcService.js";

const PHASE = Object.freeze({
  LOADING: "loading",
  INTRO: "intro",
  QUESTIONS: "questions",
  SUBMITTING: "submitting",
  RESULTS: "results",
  ERROR: "error",
});

function detectContradiction(answers) {
  const exp = Number(answers.core_exp_01);
  const rally = Number(answers.core_gs_03);
  if (!Number.isFinite(exp) || !Number.isFinite(rally)) return false;
  return exp <= 2 && rally >= 5;
}

function buildAdaptiveQueue(answers, askedIds, contradictionDetected = false) {
  const order = [];
  const adaptiveIds = [];
  const workingAnswers = { ...answers };
  const workingAsked = [...askedIds];

  for (let i = 0; i < MAX_ADAPTIVE_QUESTIONS; i += 1) {
    const next = selectNextAdaptiveQuestion({
      answers: workingAnswers,
      askedIds: workingAsked,
      contradictionDetected,
    });
    if (!next) break;
    order.push(next.id);
    adaptiveIds.push(next.id);
    workingAsked.push(next.id);
    const domainAnchor = workingAnswers[next.domain];
    workingAnswers[next.id] = Number.isFinite(domainAnchor) ? domainAnchor : 3;
  }
  return { order, adaptiveIds };
}

async function resolveAccessToken() {
  const client = getSupabaseAuthClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data?.session?.access_token ?? null;
}

export function useV5AssessmentSession({ ratingMode = RATING_MODE.DOUBLES, onComplete } = {}) {
  const [phase, setPhase] = useState(PHASE.LOADING);
  const [error, setError] = useState(null);
  const [assessmentId, setAssessmentId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionOrder, setQuestionOrder] = useState(() => [...CORE_QUESTION_ORDER]);
  const [adaptiveQuestionIds, setAdaptiveQuestionIds] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const submitLockRef = useRef(false);

  const answeredQuestionIds = useMemo(
    () => questionOrder.filter((qid) => answers[qid] != null),
    [answers, questionOrder],
  );

  const currentQuestionId = questionOrder[currentStep] ?? null;
  const currentQuestion = currentQuestionId ? getQuestionById(currentQuestionId) : null;
  const coreComplete = CORE_QUESTION_ORDER.every((qid) => answers[qid] != null);
  const totalQuestions = questionOrder.length;
  const canSubmit = coreComplete
    && questionOrder.every((qid) => answers[qid] != null)
    && currentStep >= totalQuestions - 1;

  const persistDraft = useCallback((patch = {}) => {
    saveRatingV5Draft({
      assessment_id: patch.assessmentId ?? assessmentId,
      answers: patch.answers ?? answers,
      current_step: patch.currentStep ?? currentStep,
      answered_question_ids: patch.answeredQuestionIds ?? answeredQuestionIds,
      adaptive_question_ids: patch.adaptiveQuestionIds ?? adaptiveQuestionIds,
      question_order: patch.questionOrder ?? questionOrder,
      started_at: patch.startedAt ?? new Date().toISOString(),
    });
  }, [adaptiveQuestionIds, answers, assessmentId, answeredQuestionIds, currentStep, questionOrder]);

  const bootstrap = useCallback(async () => {
    setPhase(PHASE.LOADING);
    setError(null);

    if (ratingMode === RATING_MODE.SINGLES) {
      setError({ code: "SINGLES_NOT_IMPLEMENTED", message: resolveAssessmentErrorMessage("SINGLES_NOT_IMPLEMENTED") });
      setPhase(PHASE.ERROR);
      return;
    }

    const draft = loadRatingV5Draft();
    if (draft && isDraftVersionMismatch(draft)) {
      clearRatingV5Draft();
      setError({ code: "VERSION_MISMATCH", message: resolveAssessmentErrorMessage("VERSION_MISMATCH") });
      setPhase(PHASE.ERROR);
      return;
    }

    if (draft?.assessment_id && draft.question_order?.length) {
      setAssessmentId(draft.assessment_id);
      setAnswers(draft.answers ?? {});
      setQuestionOrder(draft.question_order);
      setAdaptiveQuestionIds(draft.adaptive_question_ids ?? []);
      setCurrentStep(Math.min(draft.current_step ?? 0, draft.question_order.length - 1));
      setPhase(PHASE.QUESTIONS);
      return;
    }

    setPhase(PHASE.INTRO);
  }, [ratingMode]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const startAssessment = useCallback(async () => {
    setError(null);
    const start = await rpcRatingV5StartAssessment(ratingMode);
    if (!start.ok) {
      setError({
        code: start.code ?? "RPC_FAILED",
        message: resolveAssessmentErrorMessage(start.code),
      });
      setPhase(PHASE.ERROR);
      return;
    }

    const id = start.assessmentId ?? start.assessment_id;
    setAssessmentId(id);
    setAnswers({});
    setQuestionOrder([...CORE_QUESTION_ORDER]);
    setAdaptiveQuestionIds([]);
    setCurrentStep(0);
    persistDraft({
      assessmentId: id,
      answers: {},
      currentStep: 0,
      questionOrder: [...CORE_QUESTION_ORDER],
      adaptiveQuestionIds: [],
      answeredQuestionIds: [],
      startedAt: new Date().toISOString(),
    });
    setPhase(PHASE.QUESTIONS);
  }, [persistDraft, ratingMode]);

  const answerCurrentQuestion = useCallback((anchorValue) => {
    if (!currentQuestionId) return;
    const nextAnswers = { ...answers, [currentQuestionId]: Number(anchorValue) };
    setAnswers(nextAnswers);

    let nextOrder = questionOrder;
    let nextAdaptive = adaptiveQuestionIds;
    const nextAnswered = questionOrder.filter((qid) => nextAnswers[qid] != null);

    const allCoreDone = CORE_QUESTION_ORDER.every((qid) => nextAnswers[qid] != null);
    if (allCoreDone && adaptiveQuestionIds.length === 0) {
      const built = buildAdaptiveQueue(
        nextAnswers,
        Object.keys(nextAnswers),
        detectContradiction(nextAnswers),
      );
      if (built.order.length) {
        nextOrder = [...CORE_QUESTION_ORDER, ...built.order];
        nextAdaptive = built.adaptiveIds;
        setQuestionOrder(nextOrder);
        setAdaptiveQuestionIds(nextAdaptive);
      }
    }

    const nextStep = Math.min(currentStep + 1, nextOrder.length - 1);
    setCurrentStep(nextStep);
    persistDraft({
      answers: nextAnswers,
      currentStep: nextStep,
      questionOrder: nextOrder,
      adaptiveQuestionIds: nextAdaptive,
      answeredQuestionIds: nextAnswered,
    });
  }, [adaptiveQuestionIds, answers, currentQuestionId, currentStep, persistDraft, questionOrder]);

  const goBack = useCallback(() => {
    if (currentStep <= 0) return;
    const prev = currentStep - 1;
    setCurrentStep(prev);
    persistDraft({ currentStep: prev });
  }, [currentStep, persistDraft]);

  const submitAssessment = useCallback(async () => {
    if (submitLockRef.current || !assessmentId || !canSubmit) return;
    submitLockRef.current = true;
    setPhase(PHASE.SUBMITTING);
    setError(null);

    try {
      const token = await resolveAccessToken();
      const edgeResult = await completeRatingV5Assessment({
        accessToken: token,
        edgeBaseUrl: getRatingV5EdgeBaseUrl(),
        assessmentId,
        answers,
        ratingMode,
      });

      if (!edgeResult.ok) {
        const code = edgeResult.code ?? edgeResult.error?.code ?? "PERSISTENCE_FAILED";
        setError({ code, message: resolveAssessmentErrorMessage(code) });
        setPhase(PHASE.ERROR);
        return;
      }

      const payload = edgeResult.data ?? edgeResult;
      setResult(payload);
      clearRatingV5Draft();
      setPhase(PHASE.RESULTS);
      onComplete?.(payload);
    } finally {
      submitLockRef.current = false;
    }
  }, [answers, assessmentId, canSubmit, onComplete, ratingMode]);

  const restartAssessment = useCallback(() => {
    clearRatingV5Draft();
    setAssessmentId(null);
    setAnswers({});
    setQuestionOrder([...CORE_QUESTION_ORDER]);
    setAdaptiveQuestionIds([]);
    setCurrentStep(0);
    setResult(null);
    setError(null);
    setPhase(PHASE.INTRO);
  }, []);

  return {
    phase,
    error,
    assessmentId,
    answers,
    questionOrder,
    adaptiveQuestionIds,
    currentStep,
    currentQuestionId,
    currentQuestion,
    answeredQuestionIds,
    coreQuestionCount: CORE_QUESTION_COUNT,
    maxAdaptiveQuestions: MAX_ADAPTIVE_QUESTIONS,
    maxTotalQuestions: CORE_QUESTION_COUNT + MAX_ADAPTIVE_QUESTIONS,
    totalQuestions,
    canSubmit,
    result,
    startAssessment,
    answerCurrentQuestion,
    goBack,
    submitAssessment,
    restartAssessment,
    isSubmitting: phase === PHASE.SUBMITTING,
  };
}

export { PHASE as V5_ASSESSMENT_PHASE };
