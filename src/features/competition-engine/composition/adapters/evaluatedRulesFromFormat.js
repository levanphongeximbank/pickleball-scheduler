/**
 * Build CORE-09 EvaluatedMatchGenerationRules from format stage config.
 */

import {
  BYE_POLICY,
  BRACKET_SIZE_POLICY,
  MATCH_GENERATION_STRATEGY,
  ROUND_ROBIN_MODE,
  THIRD_PLACE_POLICY,
  createEvaluatedMatchGenerationRules,
} from "../../../competition-core/match-generation/index.js";
import { computeDeterministicFingerprint } from "../fingerprint.js";

/**
 * @param {{
 *   strategy: string,
 *   ruleSetId?: string,
 *   ruleSetVersion?: string,
 *   bracketSizePolicy?: string,
 *   byePolicy?: string,
 *   thirdPlacePolicy?: string,
 *   encounterCount?: number,
 * }} input
 */
export function createEvaluatedRulesForStrategy(input) {
  const ruleSetId = input.ruleSetId || "e2e02-rules";
  const ruleSetVersion = input.ruleSetVersion || "1";
  const fingerprint = computeDeterministicFingerprint(
    {
      strategy: input.strategy,
      ruleSetId,
      ruleSetVersion,
      bracketSizePolicy: input.bracketSizePolicy,
      byePolicy: input.byePolicy,
      encounterCount: input.encounterCount ?? 1,
    },
    "rules"
  );

  return createEvaluatedMatchGenerationRules({
    ruleSetId,
    ruleSetVersion,
    ruleEvaluationFingerprint: fingerprint,
    generationStrategy: input.strategy,
    roundRobinMode: ROUND_ROBIN_MODE.SINGLE,
    encounterCount: input.encounterCount ?? 1,
    bracketSizePolicy:
      input.bracketSizePolicy || BRACKET_SIZE_POLICY.POWER_OF_TWO,
    byePolicy: input.byePolicy || BYE_POLICY.NONE,
    thirdPlacePolicy:
      input.thirdPlacePolicy || THIRD_PLACE_POLICY.NONE,
    deterministicSeedPolicy: "e2e02-deterministic",
  });
}

export function createPoolStageEvaluatedRules(_format) {
  void _format;
  return createEvaluatedRulesForStrategy({
    strategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
    ruleSetId: "e2e02-pool-rules",
    byePolicy: BYE_POLICY.NONE,
  });
}

export function createKnockoutStageEvaluatedRules(format) {
  return createEvaluatedRulesForStrategy({
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
    ruleSetId: "e2e02-ko-rules",
    bracketSizePolicy: format?.knockoutStage?.bracketSizePolicy,
    byePolicy: format?.knockoutStage?.byePolicy || BYE_POLICY.EXPLICIT_PLACEMENTS,
    thirdPlacePolicy: THIRD_PLACE_POLICY.NONE,
  });
}
