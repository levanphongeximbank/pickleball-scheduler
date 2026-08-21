/**
 * Effective Competition Rules resolver.
 * Composes profile normalization + validation + stage override + capability + CORE-01 authority context.
 * Does NOT create a parallel generic Rule Engine.
 */

import { RULE_SOURCE } from "../../constraints/authority/ruleSource.js";
import { RULE_OPERATION } from "../../constraints/operations/ruleOperations.js";
import { createCompetitionRulesProfile } from "../domain/competitionRulesProfile.js";
import { validateCompetitionRulesProfile } from "./validateCompetitionRulesProfile.js";
import { deriveQualificationPlan } from "./deriveQualificationPlan.js";
import {
  resolveTieBreakPolicy,
  resolveWildcardRankingPolicy,
} from "./resolveTieBreakPolicy.js";
import { resolveStageMatchRules } from "./resolveStageMatchRules.js";
import { resolveProfileCapabilityState } from "./resolveCapabilityState.js";
import { composeCore01AuthorityContext } from "../adapters/core01Composition.js";

/**
 * @param {object} [rawProfile]
 * @param {{
 *   stage?: string,
 *   ruleSource?: string,
 *   operation?: string,
 *   enforceExecutionCapability?: boolean,
 *   requireTenant?: boolean,
 *   requireCompetition?: boolean,
 * }} [context]
 */
export function resolveEffectiveCompetitionRules(rawProfile = {}, context = {}) {
  const validation = validateCompetitionRulesProfile(rawProfile, {
    enforceExecutionCapability: context.enforceExecutionCapability === true,
    requireTenant: context.requireTenant,
    requireCompetition: context.requireCompetition,
  });

  if (!validation.ok) {
    return Object.freeze({
      ok: false,
      feasible: false,
      profile: validation.profile,
      issues: validation.issues,
      engineComposition: Object.freeze({
        core01: "NOT_APPLIED_INVALID_PROFILE",
        parallelRuleEngine: false,
      }),
    });
  }

  const profile = validation.profile;
  const core01 = composeCore01AuthorityContext({
    source: context.ruleSource || RULE_SOURCE.TOURNAMENT,
    operation: context.operation || RULE_OPERATION.SCORING,
    tenantId: profile.tenantId,
    competitionId: profile.competitionId,
  });

  const qualificationPlan = deriveQualificationPlan({
    groupCount: profile.groupStage.groupCount,
    totalQualifiers: profile.qualification.totalQualifiers,
    directQualifiersPerGroup: profile.qualification.directQualifiersPerGroup,
    groupStageEnabled: profile.groupStage.groupStageEnabled,
  });

  const tieBreak = resolveTieBreakPolicy(profile);
  const wildcardRanking = resolveWildcardRankingPolicy(profile);
  const capability = resolveProfileCapabilityState(profile);

  let stageRules = null;
  if (context.stage) {
    stageRules = resolveStageMatchRules(profile, context.stage);
    if (!stageRules.ok) {
      return Object.freeze({
        ok: false,
        feasible: false,
        profile,
        issues: Object.freeze([
          {
            code: stageRules.code,
            message: stageRules.message,
            details: { stage: context.stage },
          },
        ]),
        engineComposition: Object.freeze({
          core01: core01.ok ? "COMPOSED" : "UNAVAILABLE",
          parallelRuleEngine: false,
        }),
      });
    }
  }

  const blocked = capability.blockedConfigured || [];
  const feasible =
    qualificationPlan.ok &&
    blocked.length === 0 &&
    (stageRules == null || stageRules.ok);

  return Object.freeze({
    ok: true,
    feasible,
    profile,
    qualificationPlan,
    tieBreak,
    wildcardRanking,
    stageRules,
    capability,
    authority: Object.freeze({
      ruleSource: core01.source,
      ruleSourcePriority: core01.sourcePriority,
      operation: core01.operation,
      core01,
    }),
    engineComposition: Object.freeze({
      core01: core01.ok ? "COMPOSED" : "UNAVAILABLE",
      parallelRuleEngine: false,
      scoringExecution: "CORE-16",
      standingsExecution: "CORE-18",
      refereeAssignment: "CORE-13",
      matchLifecycle: "CORE-15",
      resultAcceptance: "CORE-17",
    }),
  });
}

/**
 * Convenience: get normalized profile without full effective resolve.
 * @param {object} [raw]
 */
export function getCompetitionRulesProfile(raw) {
  return createCompetitionRulesProfile(raw);
}
