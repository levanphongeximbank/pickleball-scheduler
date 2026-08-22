/**
 * Qualification / knockout-slot derivation — policy only.
 * Does not rank standings or select qualifiers (execution remains CORE-18 / CE).
 *
 * Canonical formula:
 *   TOTAL_KNOCKOUT_SLOTS
 *     = DIRECT_KNOCKOUT_ENTRY_SLOTS
 *     + GROUP_DIRECT_QUALIFIER_SLOTS
 *     + WILDCARD_SLOTS
 *
 * Common numeric invariants are enforced before the group / no-group branch.
 */

import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";

/**
 * @param {{
 *   groupCount?: number,
 *   totalQualifiers?: number,
 *   totalKnockoutSlots?: number,
 *   directQualifiersPerGroup?: number,
 *   directKnockoutEntryCount?: number,
 *   directKnockoutEntrySlots?: number,
 *   groupStageEnabled?: boolean,
 * }} input
 */
export function deriveQualificationPlan(input = {}) {
  const groupStageEnabled = input.groupStageEnabled !== false;
  const groupCount = Math.floor(Number(input.groupCount) || 0);
  const totalKnockoutSlots = Math.floor(
    Number(
      input.totalKnockoutSlots != null
        ? input.totalKnockoutSlots
        : input.totalQualifiers
    ) || 0
  );
  const directQualifiersPerGroup = Math.floor(
    Number(input.directQualifiersPerGroup) || 0
  );
  const directKnockoutEntrySlots = Math.floor(
    Number(
      input.directKnockoutEntrySlots != null
        ? input.directKnockoutEntrySlots
        : input.directKnockoutEntryCount
    ) || 0
  );

  // --- Common invariants (group and no-group) ---
  if (totalKnockoutSlots < 1) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.INVALID_QUALIFICATION,
      message: "totalKnockoutSlots (totalQualifiers) must be >= 1",
      details: Object.freeze({ totalKnockoutSlots }),
    });
  }
  if (directKnockoutEntrySlots < 0) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.INVALID_QUALIFICATION,
      message: "directKnockoutEntrySlots must be >= 0",
      details: Object.freeze({ directKnockoutEntrySlots }),
    });
  }
  if (directKnockoutEntrySlots > totalKnockoutSlots) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_QUALIFICATION,
      message: "directKnockoutEntrySlots exceed totalKnockoutSlots",
      details: Object.freeze({
        directKnockoutEntrySlots,
        totalKnockoutSlots,
      }),
    });
  }

  if (!groupStageEnabled) {
    const remainingSlots = totalKnockoutSlots - directKnockoutEntrySlots;
    return Object.freeze({
      ok: true,
      groupStageEnabled: false,
      groupCount: 0,
      totalKnockoutSlots,
      totalQualifiers: totalKnockoutSlots,
      directQualifiersPerGroup: 0,
      directKnockoutEntrySlots,
      groupDirectQualifierSlots: 0,
      /** @deprecated alias — prefer groupDirectQualifierSlots */
      directSlots: 0,
      wildcardSlots: 0,
      /**
       * Base knockout population slots not explained by directKnockoutEntry.
       * NOT cross-group wildcard slots (requiresCrossGroupWildcardRanking=false).
       */
      remainingSlots,
      requiresCrossGroupWildcardRanking: false,
      details: Object.freeze({
        note:
          "group stage disabled — remainingSlots are base no-group knockout population slots, not cross-group wildcards",
        formula:
          "remainingSlots = totalKnockoutSlots - directKnockoutEntrySlots; wildcardSlots = 0",
      }),
    });
  }

  if (groupCount < 1) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.INVALID_GROUP_CONFIG,
      message: "groupCount must be >= 1",
      details: Object.freeze({ groupCount }),
    });
  }
  if (directQualifiersPerGroup < 0) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.INVALID_QUALIFICATION,
      message: "directQualifiersPerGroup must be >= 0",
      details: Object.freeze({ directQualifiersPerGroup }),
    });
  }

  const groupDirectQualifierSlots = groupCount * directQualifiersPerGroup;
  /** @deprecated alias — prefer groupDirectQualifierSlots */
  const directSlots = groupDirectQualifierSlots;
  const wildcardSlots =
    totalKnockoutSlots - directKnockoutEntrySlots - groupDirectQualifierSlots;
  const remainingSlots = wildcardSlots;
  const requiresCrossGroupWildcardRanking = wildcardSlots > 0;

  if (groupDirectQualifierSlots + directKnockoutEntrySlots > totalKnockoutSlots) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_QUALIFICATION,
      message:
        "groupDirectQualifierSlots + directKnockoutEntrySlots exceed totalKnockoutSlots",
      details: Object.freeze({
        groupCount,
        directQualifiersPerGroup,
        groupDirectQualifierSlots,
        directKnockoutEntrySlots,
        totalKnockoutSlots,
      }),
    });
  }
  if (wildcardSlots < 0) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_QUALIFICATION,
      message: "wildcardSlots would be negative",
      details: Object.freeze({
        groupDirectQualifierSlots,
        directKnockoutEntrySlots,
        totalKnockoutSlots,
        wildcardSlots,
      }),
    });
  }

  return Object.freeze({
    ok: true,
    groupStageEnabled: true,
    groupCount,
    totalKnockoutSlots,
    totalQualifiers: totalKnockoutSlots,
    directQualifiersPerGroup,
    directKnockoutEntrySlots,
    groupDirectQualifierSlots,
    directSlots,
    wildcardSlots,
    remainingSlots,
    requiresCrossGroupWildcardRanking,
    details: Object.freeze({
      formula:
        "totalKnockoutSlots = directKnockoutEntrySlots + groupDirectQualifierSlots + wildcardSlots; groupDirectQualifierSlots = groupCount * directQualifiersPerGroup",
      distinctions: Object.freeze({
        GROUP_STAGE_BYPASS: "exclusion from group participation",
        DIRECT_KNOCKOUT_ENTRY: "knockout slot without group qualification",
        KNOCKOUT_BYE: "admitted unit skips a knockout round via bracket bye",
        SEEDING: "ordering/placement only — does not imply direct admission",
      }),
    }),
  });
}
