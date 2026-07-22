/**
 * CORE-10 Phase 1D — candidate-ranking throw-only failure codes.
 * Not stored on CandidateEvaluationResult / CandidateEvaluationFailure.
 */

export const CANDIDATE_RANKING_FAILURE_CODE = Object.freeze({
  INVALID_CANDIDATE_RANKING_INPUT: "INVALID_CANDIDATE_RANKING_INPUT",
  DUPLICATE_CANDIDATE_ID: "DUPLICATE_CANDIDATE_ID",
});

export const CANDIDATE_RANKING_FAILURE_CODE_VALUES = Object.freeze(
  Object.values(CANDIDATE_RANKING_FAILURE_CODE)
);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isCandidateRankingFailureCode(value) {
  return (
    typeof value === "string" &&
    CANDIDATE_RANKING_FAILURE_CODE_VALUES.includes(value)
  );
}
