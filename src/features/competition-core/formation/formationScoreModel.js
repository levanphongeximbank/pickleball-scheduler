import { DEFAULT_FORMATION_SCORE_WEIGHTS } from "./formationConstants.js";

/**
 * Reference formation score computation — foundation only.
 * Does NOT invoke AI pairing or Daily Play runtime engines.
 *
 * @param {Record<string, unknown>} input
 * @param {Partial<typeof DEFAULT_FORMATION_SCORE_WEIGHTS>} [weights]
 * @returns {import('./formationTypes.js').FormationScoreBreakdown}
 */
export function computeReferenceFormationScoreComponents(input = {}, weights = {}) {
  const w = { ...DEFAULT_FORMATION_SCORE_WEIGHTS, ...weights };
  const skillScore = Number(input.skillScore ?? input.averageSkill ?? input.level ?? 0);
  const repeatPenalty = Number(input.repeatCount ?? 0) * w.repeatPenalty;
  const opponentPenalty = Number(input.opponentRepeatCount ?? 0) * w.opponentPenalty;
  const restPenalty = Number(input.restViolations ?? 0) * w.restPenalty;
  const genderBonus = input.genderBalanced === true ? w.genderBonus : 0;
  const balanceScore = Number(input.balanceScore ?? 0) * w.balanceScore;
  const availabilityScore =
    input.available === false ? -w.availabilityScore : Number(input.availabilityScore ?? 0);
  const manualAdjustment = Number(input.manualAdjustment ?? 0) * w.manualAdjustment;
  const randomComponent = Number(input.randomComponent ?? 0) * w.randomComponent;

  const finalScore =
    skillScore * w.skillScore +
    balanceScore +
    genderBonus +
    availabilityScore +
    manualAdjustment +
    randomComponent -
    repeatPenalty -
    opponentPenalty -
    restPenalty;

  return {
    skillScore,
    repeatPenalty,
    opponentPenalty,
    restPenalty,
    genderBonus,
    balanceScore,
    availabilityScore,
    manualAdjustment,
    randomComponent,
    finalScore: Math.round(finalScore * 1000) / 1000,
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationScoreBreakdown>} [partial]
 * @returns {import('./formationTypes.js').FormationScoreBreakdown}
 */
export function buildFormationScoreBreakdown(partial = {}) {
  return computeReferenceFormationScoreComponents(partial, {});
}
