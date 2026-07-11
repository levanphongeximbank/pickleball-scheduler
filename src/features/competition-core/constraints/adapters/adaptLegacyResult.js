/**
 * Adapt canonical evaluation results back to legacy consumer shapes.
 */

/**
 * pairing-constraints evaluator shape.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @returns {{ score: number, violations: Array<Record<string, unknown>>, satisfied: unknown[], hardViolations: Array<Record<string, unknown>>, ok: boolean }}
 */
export function toPairingConstraintEvaluation(canonical) {
  const violations = (canonical.hardViolations || []).map((item) => ({
    constraint: item.details?.constraintId ? { id: item.details.constraintId } : undefined,
    message: item.message,
    code: item.reasonCode,
    soft: false,
  }));

  const softNotes = (canonical.softNotes || []).map((item) => ({
    constraint: item.details?.constraintId ? { id: item.details.constraintId } : undefined,
    message: item.message,
    code: item.reasonCode,
    soft: true,
  }));

  const allViolations = [...violations, ...softNotes];

  return {
    score: Number(canonical.softScore ?? 0),
    violations: allViolations,
    satisfied: [],
    hardViolations: violations,
    ok: canonical.feasible !== false,
  };
}

/**
 * AI scoring adjustment — preserve legacy score envelope when feasible.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @param {number} [baseScore]
 * @returns {{ rejected: boolean, totalScore: number, canonicalSoftDelta: number, policyScore: number, ruleScore: number }}
 */
export function toAiScoreBridgeResult(canonical, baseScore = 0) {
  if (!canonical.feasible) {
    return {
      rejected: true,
      totalScore: -100,
      canonicalSoftDelta: 0,
      policyScore: 0,
      ruleScore: 0,
    };
  }

  const softDelta = Number(canonical.softScore ?? 0);
  return {
    rejected: false,
    totalScore: baseScore + softDelta,
    canonicalSoftDelta: softDelta,
    policyScore: softDelta,
    ruleScore: 0,
  };
}

/**
 * Tournament validation adapter shape.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function toValidationResult(canonical) {
  const errors = (canonical.hardViolations || []).map((item) => item.message).filter(Boolean);
  const warnings = (canonical.softNotes || []).map((item) => item.message).filter(Boolean);

  if (!canonical.eligible) {
    errors.push("Entry eligibility failed.");
  }

  return {
    ok: canonical.feasible !== false && canonical.eligible !== false && errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Daily Play eligibility adapter.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @param {string} playerId
 * @returns {boolean}
 */
export function isDailyPlayPlayerEligible(canonical, playerId) {
  if (!canonical.feasible || !canonical.eligible) {
    return false;
  }

  const blocked = (canonical.hardViolations || []).some((item) =>
    (item.affectedPlayers || []).includes(String(playerId))
  );
  return !blocked;
}
