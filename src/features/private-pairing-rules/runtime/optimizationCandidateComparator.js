/**
 * Shared lexicographic candidate comparator for private-pairing engines.
 *
 * Independent of any specific optimizer: engines only supply penalties / feasibility;
 * ranking order is fixed by authority ladder and never collapses into a single total.
 *
 * Sort contract (Array.sort): return < 0 when `a` should rank BEFORE `b` (better).
 *
 * Order:
 *   1. Hard feasibility (feasible before infeasible)
 *   2. SUPER_ADMIN penalty (lower wins)
 *   3. TOURNAMENT penalty
 *   4. CLUB penalty
 *   5. SESSION penalty
 *   6. V6 format soft penalty
 *   7. Default optimizer penalty
 *   8. Stable seeded tie-break (id)
 *
 * `totalPenalty` is display-only and MUST NOT be used for ranking.
 */

/**
 * @typedef {Object} ScoreBreakdown
 * @property {number} superAdminPenalty
 * @property {number} tournamentPenalty
 * @property {number} clubPenalty
 * @property {number} sessionPenalty
 * @property {number} v6FormatPenalty
 * @property {number} defaultPenalty
 * @property {number} totalPenalty
 */

/**
 * @param {object} score
 * @returns {ScoreBreakdown}
 */
export function normalizeScoreBreakdown(score = {}) {
  const superAdminPenalty = Number(
    score.superAdminPenalty ?? score.superAdminSoftPenalty
  ) || 0;
  const tournamentPenalty = Number(
    score.tournamentPenalty ?? score.tournamentSoftPenalty
  ) || 0;
  const clubPenalty = Number(score.clubPenalty ?? score.clubSoftPenalty) || 0;
  const sessionPenalty = Number(
    score.sessionPenalty ?? score.sessionSoftPenalty
  ) || 0;
  const v6FormatPenalty = Number(
    score.v6FormatPenalty ?? score.v6FormatSoftPenalty
  ) || 0;
  const defaultPenalty = Number(
    score.defaultPenalty ?? score.defaultOptimizationPenalty
  ) || 0;
  // Display-only aggregate — never fed into compareOptimizationCandidates keys.
  const totalPenalty =
    Number.isFinite(Number(score.totalPenalty))
      ? Number(score.totalPenalty)
      : superAdminPenalty +
        tournamentPenalty +
        clubPenalty +
        sessionPenalty +
        v6FormatPenalty +
        defaultPenalty;

  return {
    superAdminPenalty,
    tournamentPenalty,
    clubPenalty,
    sessionPenalty,
    v6FormatPenalty,
    defaultPenalty,
    totalPenalty,
  };
}

/**
 * Build scoreBreakdown from soft penalty-by-source + default quality metrics.
 * Higher balance/fairness/formation quality → lower defaultPenalty.
 *
 * @param {object} args
 * @param {object} [args.penaltyBySource]
 * @param {number} [args.balanceScore]
 * @param {number} [args.fairnessScore]
 * @param {number} [args.formationQuality]
 * @param {number} [args.openBalanceScore]
 * @param {number} [args.defaultPenalty]
 * @param {number} [args.v6FormatPenalty]
 * @returns {ScoreBreakdown}
 */
export function buildScoreBreakdown({
  penaltyBySource = {},
  balanceScore = 0,
  fairnessScore = 0,
  formationQuality = 0,
  openBalanceScore,
  defaultPenalty: explicitDefault,
  v6FormatPenalty: explicitV6Format,
} = {}) {
  const superAdminPenalty = Number(penaltyBySource.SUPER_ADMIN) || 0;
  const tournamentPenalty = Number(penaltyBySource.TOURNAMENT) || 0;
  const clubPenalty = Number(penaltyBySource.CLUB) || 0;
  const sessionPenalty = Number(penaltyBySource.SESSION) || 0;
  const v6FormatPenalty = Number.isFinite(Number(explicitV6Format))
    ? Math.max(0, Number(explicitV6Format))
    : Number(penaltyBySource.V6_FORMAT) || 0;

  let defaultPenalty;
  if (Number.isFinite(Number(explicitDefault))) {
    defaultPenalty = Math.max(0, Number(explicitDefault));
  } else if (Number.isFinite(Number(openBalanceScore))) {
    defaultPenalty = Math.max(0, Number(openBalanceScore));
  } else {
    const qualitySignal = Math.max(
      Number(balanceScore) || 0,
      Number(fairnessScore) || 0,
      Number(formationQuality) || 0
    );
    defaultPenalty = Math.max(0, Math.round(200 - qualitySignal * 2));
  }

  return normalizeScoreBreakdown({
    superAdminPenalty,
    tournamentPenalty,
    clubPenalty,
    sessionPenalty,
    v6FormatPenalty,
    defaultPenalty,
  });
}

/** Lexicographic keys in authority order — totalPenalty intentionally excluded. */
const LEXICOGRAPHIC_KEYS = Object.freeze([
  "superAdminPenalty",
  "tournamentPenalty",
  "clubPenalty",
  "sessionPenalty",
  "v6FormatPenalty",
  "defaultPenalty",
]);

/**
 * Resolve scoreBreakdown from a scored candidate (new or legacy field names).
 *
 * @param {object} candidate
 * @returns {ScoreBreakdown}
 */
export function getCandidateScoreBreakdown(candidate = {}) {
  if (candidate.scoreBreakdown) {
    return normalizeScoreBreakdown(candidate.scoreBreakdown);
  }
  if (candidate.optimizationRuleScore) {
    return normalizeScoreBreakdown(candidate.optimizationRuleScore);
  }
  return normalizeScoreBreakdown(candidate);
}

/**
 * Lexicographic comparator for Array.sort.
 * Returns < 0 when `a` ranks better (should come first).
 *
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareOptimizationCandidates(a, b) {
  const feasibleA = a?.feasible !== false;
  const feasibleB = b?.feasible !== false;
  if (feasibleA !== feasibleB) {
    return feasibleA ? -1 : 1;
  }
  if (!feasibleA && !feasibleB) {
    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  }

  const scoreA = getCandidateScoreBreakdown(a);
  const scoreB = getCandidateScoreBreakdown(b);

  for (const key of LEXICOGRAPHIC_KEYS) {
    if (scoreA[key] !== scoreB[key]) {
      // Lower penalty wins → a before b when scoreA[key] < scoreB[key]
      return scoreA[key] - scoreB[key];
    }
  }

  // Stable seeded tie-break
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

/**
 * Sort candidates best-first using the shared lexicographic comparator.
 *
 * @param {object[]} candidates
 * @returns {object[]}
 */
export function sortCandidatesByOptimizationRank(candidates = []) {
  return [...candidates].sort(compareOptimizationCandidates);
}

// ---------------------------------------------------------------------------
// Back-compat aliases (Phase 2 transition) — prefer scoreBreakdown going forward
// ---------------------------------------------------------------------------

/**
 * @deprecated Use buildScoreBreakdown / normalizeScoreBreakdown
 */
export function buildOptimizationRuleScore(args) {
  const breakdown = buildScoreBreakdown(args);
  return {
    ...breakdown,
    superAdminSoftPenalty: breakdown.superAdminPenalty,
    tournamentSoftPenalty: breakdown.tournamentPenalty,
    clubSoftPenalty: breakdown.clubPenalty,
    sessionSoftPenalty: breakdown.sessionPenalty,
    defaultOptimizationPenalty: breakdown.defaultPenalty,
    privatePairingSoftPenalty:
      breakdown.superAdminPenalty +
      breakdown.tournamentPenalty +
      breakdown.clubPenalty +
      breakdown.sessionPenalty,
  };
}

/**
 * @deprecated Use normalizeScoreBreakdown
 */
export function normalizeOptimizationRuleScore(score = {}) {
  return buildOptimizationRuleScore({
    penaltyBySource: {
      SUPER_ADMIN: score.superAdminPenalty ?? score.superAdminSoftPenalty,
      TOURNAMENT: score.tournamentPenalty ?? score.tournamentSoftPenalty,
      CLUB: score.clubPenalty ?? score.clubSoftPenalty,
      SESSION: score.sessionPenalty ?? score.sessionSoftPenalty,
    },
    defaultPenalty: score.defaultPenalty ?? score.defaultOptimizationPenalty,
  });
}
