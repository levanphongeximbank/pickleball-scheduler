import { scoreAssessment } from "../assessment/assessmentScoringEngine.js";
import { validateCompleteAssessmentPayload } from "../security/completeAssessmentPayloadGuard.js";
import { DOUBLES_DOMAIN_WEIGHTS } from "../constants/domainWeights.js";
import { DERIVED_METRICS } from "../constants/derivedMetrics.js";
import { toDisplayRating, V5_MIN_RATING } from "../constants/ratingScale.js";
import { V5_RATING_STATUS } from "../constants/ratingStatus.js";
import { RATING_MODE } from "../constants/ratingModes.js";
import {
  validateAnswersForCompletion,
  validateAssessmentDraft,
  validateAssessmentOwnership,
  validateRatingMode,
  validateTenantMatch,
} from "../services/assessmentValidation.js";
import { getActiveVersionContract } from "./activeVersionContract.js";
import { assertTrustedRuntime } from "./trustedRuntimeMarker.js";

export function assertNoDerivedMetricDoubleCount(domainScores, weightedDomains = DOUBLES_DOMAIN_WEIGHTS) {
  const issues = [];
  for (const code of Object.keys(DERIVED_METRICS)) {
    if (weightedDomains[code] != null) {
      issues.push(`derived metric ${code} must not appear in domain weights`);
    }
  }
  for (const code of Object.keys(weightedDomains)) {
    if (DERIVED_METRICS[code]) {
      issues.push(`domain weight table contains derived metric ${code}`);
    }
  }
  if (domainScores) {
    for (const code of Object.keys(DERIVED_METRICS)) {
      const sources = DERIVED_METRICS[code].source_domains ?? [];
      const hasWeightedSource = sources.some((s) => weightedDomains[s] != null);
      if (!hasWeightedSource && domainScores[code] != null) {
        issues.push(`derived metric ${code} has scores but no weighted source path`);
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

function buildRatingEvent(assessment, scored, versions) {
  return {
    tenant_id: assessment.tenant_id,
    player_id: assessment.player_id,
    rating_mode: assessment.rating_mode,
    event_type: "assessment_complete",
    source_type: "questionnaire",
    source_id: String(assessment.id),
    verification_status: "confirmed",
    evidence_level: 1,
    pre_rating_mean: null,
    post_rating_mean: scored.ratingAfterGates,
    pre_deviation: null,
    post_deviation: scored.initialDeviation,
    rating_delta: scored.ratingAfterGates - V5_MIN_RATING,
    reliability_before: 0,
    reliability_after: 0,
    engine_version: versions.scoringEngineVersion,
    is_shadow: true,
    metadata: {
      assessmentVersion: versions.assessmentVersion,
      questionBankVersion: versions.questionBankVersion,
      gateVersion: versions.gateVersion,
      trustedRuntime: "pick-vn-rating-v5-trusted-server",
    },
  };
}

function buildShadowProfilePatch(assessment, scored, versions) {
  const displayRating = Math.min(toDisplayRating(scored.ratingAfterGates), 4.5);
  let ratingStatus = V5_RATING_STATUS.SELF_ASSESSED;
  if (scored.verificationRequired || scored.ratingStatus === V5_RATING_STATUS.UNDER_REVIEW) {
    ratingStatus = V5_RATING_STATUS.UNDER_REVIEW;
  } else if (scored.ratingAfterGates > V5_MIN_RATING) {
    ratingStatus = V5_RATING_STATUS.PROVISIONAL;
  }
  return {
    tenant_id: assessment.tenant_id,
    player_id: assessment.player_id,
    rating_mode: assessment.rating_mode,
    is_shadow: true,
    rollout_cohort: assessment.rollout_cohort ?? "v5-shadow-pilot",
    provisional_rating: scored.ratingAfterGates,
    open_rating_mean: scored.ratingAfterGates,
    open_rating_deviation: scored.initialDeviation,
    display_rating: displayRating,
    reliability_score: 0,
    rating_status: ratingStatus,
    evidence_level: 1,
    assessment_count: 1,
    engine_version: versions.systemVersion ?? "pick-vn-rating-v5",
    verified_rating_mean: null,
    verified_rating_deviation: null,
  };
}

function buildCompletedAssessmentRow(assessment, answers, scored, versions) {
  return {
    id: assessment.id,
    tenant_id: assessment.tenant_id,
    player_id: assessment.player_id,
    rating_mode: assessment.rating_mode,
    assessment_status: "completed",
    is_shadow: true,
    rollout_cohort: assessment.rollout_cohort ?? "v5-shadow-pilot",
    answers,
    item_scores: scored.domainScores,
    domain_scores: scored.domainScores,
    skill_vector: scored.skillVector,
    overall_skill: scored.ratingAfterGates,
    initial_mean: scored.ratingAfterGates,
    initial_deviation: scored.initialDeviation,
    provisional_rating: scored.ratingAfterGates,
    confidence_score: scored.confidenceScore,
    estimated_error: scored.estimatedError,
    warning_flags: scored.warningFlags,
    applied_gates: scored.appliedGates,
    assessment_version: versions.assessmentVersion,
    question_bank_version: versions.questionBankVersion,
    scoring_engine_version: versions.scoringEngineVersion,
    gate_version: versions.gateVersion,
    calibration_version: versions.calibrationVersion,
    glossary_version: versions.glossaryVersion,
    reliability_version: versions.reliabilityVersion,
  };
}

const SERVER_CONTEXT_KEYS = new Set([
  "userId",
  "user_id",
  "tenantId",
  "tenant_id",
  "assessment",
  "__test_fault",
  "testFault",
]);

function buildClientPayloadFromInput(input) {
  const payload = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (SERVER_CONTEXT_KEYS.has(key)) continue;
    payload[key] = value;
  }
  return payload;
}

/**
 * Full V5 gate-weighted scoring — trusted server only. Returns persistence payload.
 */
export function scoreAssessmentForPersistence(input, assessment) {
  assertTrustedRuntime("scoreAssessmentForPersistence");

  const payloadCheck = validateCompleteAssessmentPayload(buildClientPayloadFromInput(input));
  if (!payloadCheck.ok) return payloadCheck;

  const { assessmentId, answers, ratingMode } = payloadCheck;
  const userId = input.userId ?? input.user_id;
  const tenantId = input.tenantId ?? input.tenant_id;

  if (!userId) return { ok: false, code: "UNAUTHORIZED" };
  if (!tenantId) return { ok: false, code: "TENANT_UNRESOLVED" };

  const modeCheck = validateRatingMode(ratingMode);
  if (!modeCheck.ok) return modeCheck;
  if (!assessment) return { ok: false, code: "ASSESSMENT_NOT_FOUND" };

  const ownerCheck = validateAssessmentOwnership(assessment, userId);
  if (!ownerCheck.ok) return ownerCheck;

  const tenantCheck = validateTenantMatch(assessment, tenantId);
  if (!tenantCheck.ok) return tenantCheck;

  if (assessment.assessment_status === "completed") {
    const versions = getActiveVersionContract();
    return {
      ok: true,
      code: "ALREADY_COMPLETED",
      idempotent: true,
      assessmentId,
      response: {
        assessmentId,
        overall_skill: assessment.overall_skill,
        provisional_rating: assessment.provisional_rating,
        provisional_display_rating: assessment.provisional_rating != null
          ? Math.min(toDisplayRating(Number(assessment.provisional_rating)), 4.5)
          : null,
        versions: {
          assessmentVersion: assessment.assessment_version,
          questionBankVersion: assessment.question_bank_version,
          scoringEngineVersion: assessment.scoring_engine_version,
          gateVersion: assessment.gate_version,
          calibrationVersion: assessment.calibration_version,
          glossaryVersion: assessment.glossary_version,
          reliabilityVersion: assessment.reliability_version,
          systemVersion: versions.systemVersion,
        },
      },
    };
  }

  const draftCheck = validateAssessmentDraft(assessment);
  if (!draftCheck.ok) return draftCheck;

  const answerCheck = validateAnswersForCompletion(answers);
  if (!answerCheck.ok) return answerCheck;

  const versions = getActiveVersionContract();
  const scored = scoreAssessment(answers, { ratingMode: RATING_MODE.DOUBLES });

  const doubleCountCheck = assertNoDerivedMetricDoubleCount(scored.domainScores);
  if (!doubleCountCheck.ok) {
    return { ok: false, code: "DERIVED_METRIC_DOUBLE_COUNT", issues: doubleCountCheck.issues };
  }

  const provisionalDisplay = Math.min(toDisplayRating(scored.ratingAfterGates), 4.5);
  const derivedMetrics = {};
  for (const code of Object.keys(DERIVED_METRICS)) {
    derivedMetrics[code] = scored.domainScores[code] ?? null;
  }

  return {
    ok: true,
    code: "SCORED",
    assessmentId,
    answers,
    versions,
    response: {
      assessmentId,
      item_scores: scored.domainScores,
      domain_scores: scored.domainScores,
      derived_metrics: derivedMetrics,
      skill_vector: scored.skillVector,
      overall_skill: scored.ratingAfterGates,
      rating_before_gates: scored.ratingBeforeGates,
      rating_after_gates: scored.ratingAfterGates,
      estimated_rating: scored.ratingBeforeGates,
      provisional_rating: scored.ratingAfterGates,
      provisional_display_rating: provisionalDisplay,
      confidence_score: scored.confidenceScore,
      estimated_error: scored.estimatedError,
      warning_flags: scored.warningFlags,
      contradiction_flags: scored.warningFlags,
      applied_gates: scored.appliedGates,
      limiting_skills: scored.limitingSkills,
      verification_required: scored.verificationRequired,
      rating_status: scored.verificationRequired
        ? V5_RATING_STATUS.UNDER_REVIEW
        : scored.ratingStatus,
      versions,
    },
    persistence: {
      assessment_id: assessmentId,
      player_id: assessment.player_id,
      tenant_id: assessment.tenant_id,
      completed_row: buildCompletedAssessmentRow(assessment, answers, scored, versions),
      rating_event: buildRatingEvent(assessment, scored, versions),
      profile_patch: buildShadowProfilePatch(assessment, scored, versions),
      versions,
    },
  };
}
