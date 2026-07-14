/**
 * PR-4.5 — explanation envelope for ranked simulation candidates.
 */

import { EXPLANATION_CODE } from "./simulationCodes.js";
import { softTypeToExplanationCode } from "./candidateScorer.js";

function reason(code, overrides = {}) {
  return {
    code,
    messageKey: `private_pairing.simulation.reason.${code}`,
    playerIds: overrides.playerIds || [],
    ruleIds: overrides.ruleIds || [],
    value: overrides.value ?? null,
    impact: overrides.impact ?? 0,
  };
}

/**
 * @param {object} scored
 * @param {{ rank: number, topScore: number, missingRatingCount?: number }} meta
 */
export function explainSimulationCandidate(scored, meta = {}) {
  const reasons = [];
  const warnings = [];

  reasons.push(
    reason(EXPLANATION_CODE.NO_HARD_RULE_VIOLATION, {
      impact: 1,
    })
  );

  if (meta.rank === 1) {
    reasons.push(reason(EXPLANATION_CODE.TOP_RANKED_CANDIDATE, { impact: 1 }));
  }

  if (scored.balanceScore >= 80) {
    reasons.push(
      reason(EXPLANATION_CODE.BALANCED_TEAM_RATING, {
        value: scored.balanceScore,
        impact: scored.balanceScore / 100,
      })
    );
    reasons.push(
      reason(EXPLANATION_CODE.LOW_TEAM_RATING_GAP, {
        value: scored.balanceScore,
        impact: 0.5,
      })
    );
  }

  if (scored.diversityScore >= 60) {
    reasons.push(
      reason(EXPLANATION_CODE.DIVERSITY_IMPROVED, {
        value: scored.diversityScore,
        impact: scored.diversityScore / 100,
      })
    );
  }

  if (scored.fairnessScore >= 60) {
    reasons.push(
      reason(EXPLANATION_CODE.WAIT_TIME_PRIORITY, {
        value: scored.fairnessScore,
        impact: 0.4,
      })
    );
    reasons.push(
      reason(EXPLANATION_CODE.BENCH_ROTATION_FAIR, {
        value: scored.fairnessScore,
        impact: 0.3,
      })
    );
  }

  (scored.softConstraintsSatisfied || []).forEach((item) => {
    const code = softTypeToExplanationCode(item.constraintType);
    if (code) {
      reasons.push(
        reason(EXPLANATION_CODE[code] || code, {
          ruleIds: [item.ruleId],
          impact: 0.5,
        })
      );
    }
  });

  let confidence = 0.9;
  if (meta.missingRatingCount > 0) {
    warnings.push({
      code: "MISSING_PLAYER_RATING",
      count: meta.missingRatingCount,
    });
    reasons.push(
      reason(EXPLANATION_CODE.MISSING_RATING_FALLBACK, {
        value: meta.missingRatingCount,
        impact: -0.2,
      })
    );
    confidence = Math.max(0.35, confidence - meta.missingRatingCount * 0.08);
  }

  const topScore = Number(meta.topScore) || scored.finalScore || 0;
  const differenceFromTop = meta.rank === 1 ? 0 : topScore - (scored.finalScore || 0);

  return {
    reasons,
    satisfiedRules: (scored.softConstraintsSatisfied || []).map((item) => item.ruleId),
    missedSoftRules: (scored.softConstraintsMissed || []).map((item) => item.ruleId),
    warnings,
    confidence: Math.round(confidence * 1000) / 1000,
    rejectedAlternativesSummary: {
      note: "hard_rejects_excluded_from_ranking",
    },
    differenceFromTop: Number.isFinite(differenceFromTop) ? differenceFromTop : 0,
  };
}
