/**
 * Lifecycle mutation lock policy — answers whether a rule class may mutate.
 * Uses lifecycle milestone as evidence. Does NOT mutate CORE-15 lifecycle.
 */

import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import { RULE_CLASS } from "../constants/enums.js";
import {
  LIFECYCLE_MILESTONE,
  hasReachedMilestone,
} from "../constants/lifecycleMilestones.js";
import { createCompetitionRulesProfile } from "../domain/competitionRulesProfile.js";

/**
 * @param {{
 *   profile?: object,
 *   ruleClass: string,
 *   lifecycleMilestone: string,
 * }} input
 */
export function canMutateCompetitionRule(input = {}) {
  const ruleClass = String(input.ruleClass || "").trim().toUpperCase();
  const lifecycleMilestone = String(input.lifecycleMilestone || "").trim();

  if (!Object.values(RULE_CLASS).includes(ruleClass)) {
    return Object.freeze({
      allowed: false,
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.UNKNOWN_RULE_CLASS,
      message: `Unknown rule class: ${ruleClass}`,
      ruleClass,
      lifecycleMilestone,
    });
  }

  if (!Object.values(LIFECYCLE_MILESTONE).includes(lifecycleMilestone)) {
    return Object.freeze({
      allowed: false,
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.RULE_MUTATION_LOCKED,
      message: `Unknown or missing lifecycle milestone evidence: ${lifecycleMilestone}`,
      ruleClass,
      lifecycleMilestone,
    });
  }

  const profile = createCompetitionRulesProfile(input.profile || {});
  const lockAt = profile.lifecycleLocks.lockMap[ruleClass];

  if (!lockAt) {
    return Object.freeze({
      allowed: true,
      ok: true,
      code: null,
      message: "No lock configured for rule class",
      ruleClass,
      lifecycleMilestone,
      lockAt: null,
    });
  }

  const locked = hasReachedMilestone(lifecycleMilestone, lockAt);
  if (locked) {
    return Object.freeze({
      allowed: false,
      ok: true,
      code: COMPETITION_RULES_ERROR_CODE.RULE_MUTATION_LOCKED,
      message: `Rule class ${ruleClass} is immutable after ${lockAt}`,
      ruleClass,
      lifecycleMilestone,
      lockAt,
      details: Object.freeze({
        evidenceOwner: "CORE-15 lifecycle (context only)",
        mutationAuthority: "NONE — this API does not mutate lifecycle",
      }),
    });
  }

  return Object.freeze({
    allowed: true,
    ok: true,
    code: null,
    message: `Rule class ${ruleClass} may still mutate before ${lockAt}`,
    ruleClass,
    lifecycleMilestone,
    lockAt,
  });
}
