import {
  appendFormationDecisionTrace,
  createFormationAudit,
  createFormationDecisionExplanation,
  createFormationDecisionTrace,
  createFormationDecisionTraceRecord,
  createFormationResult,
  resolveFormationStrategyFromRequest,
} from "./formationContracts.js";
import { FORMATION_ENGINE_VERSION, FORMATION_STRATEGY } from "./formationConstants.js";
import { buildFormationScoreBreakdown } from "./formationScoreModel.js";

/**
 * Build foundation formation result envelope — metadata only, no runtime pairing.
 *
 * @param {import('./formationTypes.js').FormationRequest} request
 * @returns {import('./formationTypes.js').FormationResult}
 */
export function buildFoundationFormationResult(request = {}) {
  const strategy = resolveFormationStrategyFromRequest(request);
  const strategyId = strategy?.id || request.policy?.strategy || FORMATION_STRATEGY.UNKNOWN;

  const referenceScore = buildFormationScoreBreakdown({
    skillScore: 0,
    balanceScore: 0,
    finalScore: 0,
  });

  const explanation = createFormationDecisionExplanation({
    playerAId: request.players?.[0]?.id != null ? String(request.players[0].id) : null,
    playerBId: request.players?.[1]?.id != null ? String(request.players[1].id) : null,
    reason: `Strategy ${strategy?.name || strategyId} selected for foundation planning.`,
    constraints: request.constraints,
    scoreBreakdown: referenceScore,
  });

  const trace = appendFormationDecisionTrace(
    createFormationDecisionTrace(),
    createFormationDecisionTraceRecord({
      id: `formation-foundation-${Date.now()}`,
      action: "foundation_plan",
      path: explanation.decisionPath || [],
      metadata: {
        strategyId,
        playerCount: request.players?.length || 0,
        constraintCount: request.constraints?.length || 0,
        foundationOnly: true,
      },
    })
  );

  const audit = createFormationAudit({
    strategy: strategyId,
    seed: request.randomSeed ?? null,
    constraints: {
      enabled: (request.constraints || []).filter((item) => item.enabled !== false).length,
      kinds: (request.constraints || []).map((item) => item.kind),
    },
    scores: referenceScore,
    courtAllocation: {
      targetCourtCount: request.policy?.targetCourtCount ?? null,
      configuredCourts: request.courts?.length || 0,
    },
    warnings: strategyId === FORMATION_STRATEGY.UNKNOWN ? ["Unknown formation strategy"] : [],
  });

  return createFormationResult({
    ok: strategyId !== FORMATION_STRATEGY.UNKNOWN,
    pairs: [],
    courts: [],
    rounds: [],
    explanations: [explanation],
    audit,
    decisionTrace: trace,
    metadata: {
      engineVersion: FORMATION_ENGINE_VERSION,
      foundationOnly: true,
      strategyName: strategy?.name || null,
    },
  });
}
