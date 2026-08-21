/**
 * Dedicated knockout-admission mutation resolver.
 * Composes existing RULE_CLASS lock evidence — does NOT create a new RULE_CLASS
 * and does NOT mutate CORE-15.
 *
 * Required Owner locks:
 *   POST_GROUP_DRAW_DIRECT_ENTRY_MUTATION = DENY
 *   POST_GROUP_DRAW_GROUP_BYPASS_MUTATION = DENY
 *   POST_BRACKET_CREATION_BYE_MUTATION = DENY
 *
 * Mapping:
 *   DIRECT_KNOCKOUT_ENTRY / GROUP_STAGE_BYPASS → GROUP_ALLOCATION @ AFTER_GROUP_DRAW
 *   KNOCKOUT_BYE → KNOCKOUT @ AFTER_MATCH_CREATION (bracket creation evidence)
 *
 * Note: QUALIFICATION locks at AFTER_ACCEPTED_RESULT — too late alone for
 * direct-entry mutation governance; hence this dedicated composer.
 */

import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import { RULE_CLASS } from "../constants/enums.js";
import {
  LIFECYCLE_MILESTONE,
  hasReachedMilestone,
} from "../constants/lifecycleMilestones.js";
import { createCompetitionRulesProfile } from "../domain/competitionRulesProfile.js";

export const KNOCKOUT_ADMISSION_MUTATION_KIND = Object.freeze({
  GROUP_STAGE_BYPASS: "GROUP_STAGE_BYPASS",
  DIRECT_KNOCKOUT_ENTRY: "DIRECT_KNOCKOUT_ENTRY",
  KNOCKOUT_BYE: "KNOCKOUT_BYE",
  /** Entire admission policy object */
  KNOCKOUT_ADMISSION: "KNOCKOUT_ADMISSION",
});

/**
 * @param {string} kind
 * @returns {{ ruleClass: string, lockAt: string, denyLabel: string }}
 */
function resolveAdmissionLockBinding(kind) {
  switch (kind) {
    case KNOCKOUT_ADMISSION_MUTATION_KIND.GROUP_STAGE_BYPASS:
      return {
        ruleClass: RULE_CLASS.GROUP_ALLOCATION,
        lockAt: LIFECYCLE_MILESTONE.AFTER_GROUP_DRAW,
        denyLabel: "POST_GROUP_DRAW_GROUP_BYPASS_MUTATION",
      };
    case KNOCKOUT_ADMISSION_MUTATION_KIND.DIRECT_KNOCKOUT_ENTRY:
      return {
        ruleClass: RULE_CLASS.GROUP_ALLOCATION,
        lockAt: LIFECYCLE_MILESTONE.AFTER_GROUP_DRAW,
        denyLabel: "POST_GROUP_DRAW_DIRECT_ENTRY_MUTATION",
      };
    case KNOCKOUT_ADMISSION_MUTATION_KIND.KNOCKOUT_BYE:
      return {
        ruleClass: RULE_CLASS.KNOCKOUT,
        lockAt: LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION,
        denyLabel: "POST_BRACKET_CREATION_BYE_MUTATION",
      };
    case KNOCKOUT_ADMISSION_MUTATION_KIND.KNOCKOUT_ADMISSION:
      // Strictest of composed locks for the whole object
      return {
        ruleClass: RULE_CLASS.GROUP_ALLOCATION,
        lockAt: LIFECYCLE_MILESTONE.AFTER_GROUP_DRAW,
        denyLabel: "POST_GROUP_DRAW_KNOCKOUT_ADMISSION_MUTATION",
      };
    default:
      return null;
  }
}

/**
 * @param {{
 *   profile?: object,
 *   mutationKind: string,
 *   lifecycleMilestone: string,
 * }} input
 */
export function canMutateKnockoutAdmissionPolicy(input = {}) {
  const mutationKind = String(input.mutationKind || "")
    .trim()
    .toUpperCase();
  const lifecycleMilestone = String(input.lifecycleMilestone || "").trim();

  const binding = resolveAdmissionLockBinding(mutationKind);
  if (!binding) {
    return Object.freeze({
      allowed: false,
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT_ADMISSION,
      message: `Unknown knockout admission mutation kind: ${mutationKind}`,
      mutationKind,
      lifecycleMilestone,
    });
  }

  if (!Object.values(LIFECYCLE_MILESTONE).includes(lifecycleMilestone)) {
    return Object.freeze({
      allowed: false,
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.RULE_MUTATION_LOCKED,
      message: `Unknown or missing lifecycle milestone evidence: ${lifecycleMilestone}`,
      mutationKind,
      lifecycleMilestone,
    });
  }

  const profile = createCompetitionRulesProfile(input.profile || {});
  // Prefer profile lock map when present; fall back to Owner-required milestone.
  const lockAt =
    profile.lifecycleLocks.lockMap[binding.ruleClass] || binding.lockAt;

  const locked = hasReachedMilestone(lifecycleMilestone, lockAt);
  if (locked) {
    return Object.freeze({
      allowed: false,
      ok: true,
      code: COMPETITION_RULES_ERROR_CODE.RULE_MUTATION_LOCKED,
      message: `${binding.denyLabel}=DENY — immutable after ${lockAt}`,
      mutationKind,
      lifecycleMilestone,
      lockAt,
      composedRuleClass: binding.ruleClass,
      details: Object.freeze({
        POST_GROUP_DRAW_DIRECT_ENTRY_MUTATION: "DENY",
        POST_GROUP_DRAW_GROUP_BYPASS_MUTATION: "DENY",
        POST_BRACKET_CREATION_BYE_MUTATION: "DENY",
        evidenceOwner: "CORE-15 lifecycle (context only)",
        mutationAuthority: "NONE — this API does not mutate lifecycle",
        newRuleClassCreated: false,
      }),
    });
  }

  // Extra: BYE mutations also deny after bracket creation even if caller used
  // KNOCKOUT_ADMISSION kind after group draw but before match creation — bye
  // subsection still checked when kind is KNOCKOUT_BYE only. For whole-object
  // mutations after match creation, deny via additional KNOCKOUT check:
  if (
    mutationKind === KNOCKOUT_ADMISSION_MUTATION_KIND.KNOCKOUT_ADMISSION &&
    hasReachedMilestone(
      lifecycleMilestone,
      profile.lifecycleLocks.lockMap[RULE_CLASS.KNOCKOUT] ||
        LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION
    )
  ) {
    return Object.freeze({
      allowed: false,
      ok: true,
      code: COMPETITION_RULES_ERROR_CODE.RULE_MUTATION_LOCKED,
      message: "POST_BRACKET_CREATION_BYE_MUTATION=DENY — admission bye locked",
      mutationKind,
      lifecycleMilestone,
      lockAt:
        profile.lifecycleLocks.lockMap[RULE_CLASS.KNOCKOUT] ||
        LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION,
      composedRuleClass: RULE_CLASS.KNOCKOUT,
      details: Object.freeze({
        POST_GROUP_DRAW_DIRECT_ENTRY_MUTATION: "DENY",
        POST_GROUP_DRAW_GROUP_BYPASS_MUTATION: "DENY",
        POST_BRACKET_CREATION_BYE_MUTATION: "DENY",
        evidenceOwner: "CORE-15 lifecycle (context only)",
        mutationAuthority: "NONE — this API does not mutate lifecycle",
        newRuleClassCreated: false,
      }),
    });
  }

  return Object.freeze({
    allowed: true,
    ok: true,
    code: null,
    message: `Knockout admission mutation ${mutationKind} may still occur before ${lockAt}`,
    mutationKind,
    lifecycleMilestone,
    lockAt,
    composedRuleClass: binding.ruleClass,
    details: Object.freeze({
      POST_GROUP_DRAW_DIRECT_ENTRY_MUTATION: "DENY",
      POST_GROUP_DRAW_GROUP_BYPASS_MUTATION: "DENY",
      POST_BRACKET_CREATION_BYE_MUTATION: "DENY",
      newRuleClassCreated: false,
    }),
  });
}
