/**
 * Qualification / wildcard slot derivation — policy only.
 * Does not rank standings or select qualifiers (execution remains CORE-18 / CE).
 *
 * Example:
 *   groupCount=3, totalQualifiers=8, directQualifiersPerGroup=2
 *   → DIRECT_SLOTS=6, WILDCARD_SLOTS=2
 */

import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";

/**
 * @param {{
 *   groupCount?: number,
 *   totalQualifiers?: number,
 *   directQualifiersPerGroup?: number,
 *   groupStageEnabled?: boolean,
 * }} input
 */
export function deriveQualificationPlan(input = {}) {
  const groupStageEnabled = input.groupStageEnabled !== false;
  const groupCount = Math.floor(Number(input.groupCount) || 0);
  const totalQualifiers = Math.floor(Number(input.totalQualifiers) || 0);
  const directQualifiersPerGroup = Math.floor(
    Number(input.directQualifiersPerGroup) || 0
  );

  if (!groupStageEnabled) {
    return Object.freeze({
      ok: true,
      groupStageEnabled: false,
      groupCount: 0,
      totalQualifiers,
      directQualifiersPerGroup: 0,
      directSlots: 0,
      wildcardSlots: 0,
      details: Object.freeze({ note: "group stage disabled" }),
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
  if (totalQualifiers < 1) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.INVALID_QUALIFICATION,
      message: "totalQualifiers must be >= 1",
      details: Object.freeze({ totalQualifiers }),
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

  const directSlots = groupCount * directQualifiersPerGroup;
  const wildcardSlots = totalQualifiers - directSlots;

  if (directSlots > totalQualifiers) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_QUALIFICATION,
      message:
        "directSlots exceed totalQualifiers (groupCount × directQualifiersPerGroup > totalQualifiers)",
      details: Object.freeze({
        groupCount,
        directQualifiersPerGroup,
        directSlots,
        totalQualifiers,
      }),
    });
  }
  if (wildcardSlots < 0) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.IMPOSSIBLE_QUALIFICATION,
      message: "wildcardSlots would be negative",
      details: Object.freeze({ directSlots, totalQualifiers, wildcardSlots }),
    });
  }

  return Object.freeze({
    ok: true,
    groupStageEnabled: true,
    groupCount,
    totalQualifiers,
    directQualifiersPerGroup,
    directSlots,
    wildcardSlots,
    details: Object.freeze({
      formula: "directSlots = groupCount * directQualifiersPerGroup; wildcardSlots = totalQualifiers - directSlots",
    }),
  });
}
