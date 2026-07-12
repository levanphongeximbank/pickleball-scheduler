import { buildFormationScoreBreakdown } from "../formationScoreModel.js";

/**
 * @typedef {Object} FormationScoreParityResult
 * @property {boolean} ok
 * @property {boolean} comparable
 * @property {number|null} legacyFinalScore
 * @property {number|null} canonicalFinalScore
 * @property {number|null} skillScoreDifference
 * @property {number|null} repeatPenaltyDifference
 * @property {number|null} opponentPenaltyDifference
 * @property {number|null} restPenaltyDifference
 * @property {number|null} genderDifference
 * @property {number|null} balanceDifference
 * @property {number|null} availabilityDifference
 * @property {number|null} manualAdjustmentDifference
 * @property {number|null} randomComponentDifference
 * @property {string} weightVersion
 * @property {string[]} warnings
 */

function normalizeScore(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }
  const num = Number(value);
  if (num >= 0 && num <= 1) {
    return Math.round(num * 100);
  }
  if (num >= 0 && num <= 100) {
    return Math.round(num);
  }
  return null;
}

function diff(a, b) {
  if (a == null || b == null) {
    return null;
  }
  return Math.round((a - b) * 1000) / 1000;
}

/**
 * Shadow score comparison — canonical score is reference-only.
 * Legacy score remains authoritative for output ordering.
 *
 * @param {Object} input
 * @param {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} [input.legacyResult]
 * @param {import('../formationTypes.js').FormationResult} [input.formationResult]
 */
export function compareFormationScoreParity(input = {}) {
  const legacyScore =
    input.legacyResult?.score ??
    input.legacyResult?.balance?.score ??
    input.legacyResult?.metadata?.finalScore ??
    null;

  const canonicalBreakdown =
    input.formationResult?.audit?.scores ||
    input.formationResult?.selectedCandidate?.score != null
      ? buildFormationScoreBreakdown({
          finalScore: input.formationResult.selectedCandidate?.score,
        })
      : buildFormationScoreBreakdown(input.formationResult?.audit?.scores || {});

  const canonicalFinal = canonicalBreakdown.finalScore;
  const legacyNormalized = normalizeScore(legacyScore);
  const canonicalNormalized = normalizeScore(canonicalFinal);

  const warnings = [];
  let comparable = true;

  if (legacyNormalized == null || canonicalNormalized == null) {
    if (legacyScore != null || canonicalFinal != null) {
      warnings.push("SCORE_SCALE_NOT_COMPARABLE:scale_incompatible");
      comparable = false;
    }
  } else if (Math.abs(legacyNormalized - canonicalNormalized) > 50) {
      warnings.push("SCORE_SCALE_NOT_COMPARABLE:large_delta");
      comparable = false;
  } else if (legacyScore != null && canonicalFinal == null) {
    warnings.push("SCORE_SCALE_NOT_COMPARABLE:canonical_missing");
    comparable = false;
  }

  const referenceOnly = buildFormationScoreBreakdown({});

  return {
    ok: comparable ? warnings.length === 0 : true,
    comparable,
    legacyFinalScore: legacyScore != null ? Number(legacyScore) : null,
    canonicalFinalScore: canonicalFinal != null ? Number(canonicalFinal) : null,
    skillScoreDifference: diff(canonicalBreakdown.skillScore, referenceOnly.skillScore),
    repeatPenaltyDifference: diff(
      canonicalBreakdown.repeatPenalty,
      referenceOnly.repeatPenalty
    ),
    opponentPenaltyDifference: diff(
      canonicalBreakdown.opponentPenalty,
      referenceOnly.opponentPenalty
    ),
    restPenaltyDifference: diff(canonicalBreakdown.restPenalty, referenceOnly.restPenalty),
    genderDifference: diff(canonicalBreakdown.genderBonus, referenceOnly.genderBonus),
    balanceDifference: diff(canonicalBreakdown.balanceScore, referenceOnly.balanceScore),
    availabilityDifference: diff(
      canonicalBreakdown.availabilityScore,
      referenceOnly.availabilityScore
    ),
    manualAdjustmentDifference: diff(
      canonicalBreakdown.manualAdjustment,
      referenceOnly.manualAdjustment
    ),
    randomComponentDifference: diff(
      canonicalBreakdown.randomComponent,
      referenceOnly.randomComponent
    ),
    weightVersion: "cc05a-v1",
    warnings,
  };
}
