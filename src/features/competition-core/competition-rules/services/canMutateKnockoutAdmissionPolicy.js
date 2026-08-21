/**
 * Dedicated knockout-admission mutation resolver.
 * Composes existing RULE_CLASS lock evidence — does NOT create a new RULE_CLASS
 * and does NOT mutate CORE-15.
 *
 * Required Owner locks (mandatory ceilings — profiles may tighten earlier only):
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
  lifecycleMilestoneRank,
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
 * Earlier (stricter) of two milestones. Invalid ranks are ignored.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function earlierMilestone(a, b) {
  const ra = lifecycleMilestoneRank(a);
  const rb = lifecycleMilestoneRank(b);
  if (ra < 0) return b;
  if (rb < 0) return a;
  return ra <= rb ? a : b;
}

/**
 * @param {string} kind
 * @returns {{ ruleClass: string, mandatoryLockAt: string, denyLabel: string }}
 */
function resolveAdmissionLockBinding(kind) {
  switch (kind) {
    case KNOCKOUT_ADMISSION_MUTATION_KIND.GROUP_STAGE_BYPASS:
      return {
        ruleClass: RULE_CLASS.GROUP_ALLOCATION,
        mandatoryLockAt: LIFECYCLE_MILESTONE.AFTER_GROUP_DRAW,
        denyLabel: "POST_GROUP_DRAW_GROUP_BYPASS_MUTATION",
      };
    case KNOCKOUT_ADMISSION_MUTATION_KIND.DIRECT_KNOCKOUT_ENTRY:
      return {
        ruleClass: RULE_CLASS.GROUP_ALLOCATION,
        mandatoryLockAt: LIFECYCLE_MILESTONE.AFTER_GROUP_DRAW,
        denyLabel: "POST_GROUP_DRAW_DIRECT_ENTRY_MUTATION",
      };
    case KNOCKOUT_ADMISSION_MUTATION_KIND.KNOCKOUT_BYE:
      return {
        ruleClass: RULE_CLASS.KNOCKOUT,
        mandatoryLockAt: LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION,
        denyLabel: "POST_BRACKET_CREATION_BYE_MUTATION",
      };
    case KNOCKOUT_ADMISSION_MUTATION_KIND.KNOCKOUT_ADMISSION:
      // Whole-object primary ceiling is AFTER_GROUP_DRAW (bypass/direct).
      // BYE subsection also checked against AFTER_MATCH_CREATION below.
      return {
        ruleClass: RULE_CLASS.GROUP_ALLOCATION,
        mandatoryLockAt: LIFECYCLE_MILESTONE.AFTER_GROUP_DRAW,
        denyLabel: "POST_GROUP_DRAW_KNOCKOUT_ADMISSION_MUTATION",
      };
    default:
      return null;
  }
}

/**
 * effectiveLockAt = earlierOf(mandatoryAdmissionLock, configuredRuleClassLock)
 * Profile may tighten earlier; must not loosen past mandatory ceiling.
 *
 * @param {string} mandatoryLockAt
 * @param {string|null|undefined} configuredLockAt
 * @returns {{ lockAt: string, mandatoryLockAt: string, configuredLockAt: string|null, tightenedByProfile: boolean }}
 */
function resolveEffectiveAdmissionLock(mandatoryLockAt, configuredLockAt) {
  const configured =
    configuredLockAt && Object.values(LIFECYCLE_MILESTONE).includes(configuredLockAt)
      ? configuredLockAt
      : null;
  const lockAt = configured
    ? earlierMilestone(mandatoryLockAt, configured)
    : mandatoryLockAt;
  return {
    lockAt,
    mandatoryLockAt,
    configuredLockAt: configured,
    tightenedByProfile:
      configured != null &&
      lifecycleMilestoneRank(configured) < lifecycleMilestoneRank(mandatoryLockAt),
  };
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
  const effective = resolveEffectiveAdmissionLock(
    binding.mandatoryLockAt,
    profile.lifecycleLocks.lockMap[binding.ruleClass]
  );
  const lockAt = effective.lockAt;

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
      mandatoryLockAt: effective.mandatoryLockAt,
      configuredLockAt: effective.configuredLockAt,
      tightenedByProfile: effective.tightenedByProfile,
      composedRuleClass: binding.ruleClass,
      details: Object.freeze({
        POST_GROUP_DRAW_DIRECT_ENTRY_MUTATION: "DENY",
        POST_GROUP_DRAW_GROUP_BYPASS_MUTATION: "DENY",
        POST_BRACKET_CREATION_BYE_MUTATION: "DENY",
        PROFILE_CAN_LOOSEN_ADMISSION_HARD_LOCK: false,
        PROFILE_CAN_TIGHTEN_ADMISSION_LOCK: true,
        evidenceOwner: "CORE-15 lifecycle (context only)",
        mutationAuthority: "NONE — this API does not mutate lifecycle",
        newRuleClassCreated: false,
      }),
    });
  }

  // Whole-object mutations: also enforce BYE hard ceiling (may not loosen past
  // AFTER_MATCH_CREATION even if GROUP_ALLOCATION lock alone would still allow).
  if (mutationKind === KNOCKOUT_ADMISSION_MUTATION_KIND.KNOCKOUT_ADMISSION) {
    const byeEffective = resolveEffectiveAdmissionLock(
      LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION,
      profile.lifecycleLocks.lockMap[RULE_CLASS.KNOCKOUT]
    );
    if (hasReachedMilestone(lifecycleMilestone, byeEffective.lockAt)) {
      return Object.freeze({
        allowed: false,
        ok: true,
        code: COMPETITION_RULES_ERROR_CODE.RULE_MUTATION_LOCKED,
        message:
          "POST_BRACKET_CREATION_BYE_MUTATION=DENY — admission bye locked",
        mutationKind,
        lifecycleMilestone,
        lockAt: byeEffective.lockAt,
        mandatoryLockAt: byeEffective.mandatoryLockAt,
        configuredLockAt: byeEffective.configuredLockAt,
        tightenedByProfile: byeEffective.tightenedByProfile,
        composedRuleClass: RULE_CLASS.KNOCKOUT,
        details: Object.freeze({
          POST_GROUP_DRAW_DIRECT_ENTRY_MUTATION: "DENY",
          POST_GROUP_DRAW_GROUP_BYPASS_MUTATION: "DENY",
          POST_BRACKET_CREATION_BYE_MUTATION: "DENY",
          PROFILE_CAN_LOOSEN_ADMISSION_HARD_LOCK: false,
          PROFILE_CAN_TIGHTEN_ADMISSION_LOCK: true,
          evidenceOwner: "CORE-15 lifecycle (context only)",
          mutationAuthority: "NONE — this API does not mutate lifecycle",
          newRuleClassCreated: false,
        }),
      });
    }
  }

  return Object.freeze({
    allowed: true,
    ok: true,
    code: null,
    message: `Knockout admission mutation ${mutationKind} may still occur before ${lockAt}`,
    mutationKind,
    lifecycleMilestone,
    lockAt,
    mandatoryLockAt: effective.mandatoryLockAt,
    configuredLockAt: effective.configuredLockAt,
    tightenedByProfile: effective.tightenedByProfile,
    composedRuleClass: binding.ruleClass,
    details: Object.freeze({
      POST_GROUP_DRAW_DIRECT_ENTRY_MUTATION: "DENY",
      POST_GROUP_DRAW_GROUP_BYPASS_MUTATION: "DENY",
      POST_BRACKET_CREATION_BYE_MUTATION: "DENY",
      PROFILE_CAN_LOOSEN_ADMISSION_HARD_LOCK: false,
      PROFILE_CAN_TIGHTEN_ADMISSION_LOCK: true,
      newRuleClassCreated: false,
    }),
  });
}
