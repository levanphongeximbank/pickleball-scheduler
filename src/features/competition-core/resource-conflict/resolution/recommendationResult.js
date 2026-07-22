/**
 * CORE-14 Phase 1E — recommendation result envelope.
 * Never returns an applied / selected mutation state.
 */

import { EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { fingerprintCore14Material } from "../deterministic/fingerprint.js";
import { sortIdentifiers } from "../deterministic/compare.js";
import { RESOLUTION_ACTION_TYPE } from "./actionTypes.js";

export const RESOLUTION_RECOMMENDATION_RESULT_VERSION =
  "core14-resolution-recommendation-result-v1";

/**
 * @param {{
 *   evaluationStatus: string,
 *   baselineDetectionFingerprint?: string | null,
 *   recommendations?: readonly object[],
 *   evaluatedCandidateCount?: number,
 *   rejectedCandidateCount?: number,
 *   unresolvedConflictCount?: number,
 *   diagnostics?: readonly object[],
 *   metadata?: Record<string, unknown> | null,
 *   deterministicFingerprint?: string | null,
 * }} input
 */
export function createRecommendationResult(input) {
  const recommendations = Object.freeze([...(input.recommendations || [])]);
  let automaticEligibleRecommendationCount = 0;
  let manualReviewRecommendationCount = 0;
  let noSafeResolutionCount = 0;
  for (const r of recommendations) {
    if (r.automaticEligible === true) automaticEligibleRecommendationCount += 1;
    if (r.actionType === RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW) {
      manualReviewRecommendationCount += 1;
    }
    if (r.actionType === RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION) {
      noSafeResolutionCount += 1;
    }
  }

  const evaluationStatus = input.evaluationStatus || EVALUATION_STATUS.COMPLETED;
  const recommendationIds = sortIdentifiers(
    recommendations.map((r) => r.recommendationId)
  );

  const deterministicFingerprint =
    typeof input.deterministicFingerprint === "string" &&
    input.deterministicFingerprint.length > 0
      ? input.deterministicFingerprint
      : fingerprintCore14Material({
          resultVersion: RESOLUTION_RECOMMENDATION_RESULT_VERSION,
          evaluationStatus,
          baselineDetectionFingerprint: input.baselineDetectionFingerprint ?? null,
          recommendationIds,
          automaticEligibleRecommendationCount,
          manualReviewRecommendationCount,
          noSafeResolutionCount,
          evaluatedCandidateCount: input.evaluatedCandidateCount ?? 0,
          rejectedCandidateCount: input.rejectedCandidateCount ?? 0,
          unresolvedConflictCount: input.unresolvedConflictCount ?? 0,
        });

  return Object.freeze({
    evaluationStatus,
    baselineDetectionFingerprint: input.baselineDetectionFingerprint ?? null,
    recommendations,
    automaticEligibleRecommendationCount,
    manualReviewRecommendationCount,
    noSafeResolutionCount,
    evaluatedCandidateCount: input.evaluatedCandidateCount ?? 0,
    rejectedCandidateCount: input.rejectedCandidateCount ?? 0,
    unresolvedConflictCount: input.unresolvedConflictCount ?? 0,
    recommendationCount: recommendations.length,
    deterministicFingerprint,
    diagnostics: Object.freeze([...(input.diagnostics || [])]),
    metadata: input.metadata == null ? null : Object.freeze({ ...input.metadata }),
    // Explicit non-application: no selectedMutationState / appliedOccupancies.
    selectedMutationState: null,
    appliedOccupancies: null,
  });
}
