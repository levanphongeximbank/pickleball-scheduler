/**
 * Group qualification → canonical first knockout round derivation.
 *
 * Coarse matchup.stage remains group|knockout (#416).
 * Resolved competition round uses COMPETITION_STAGE keys for policy/CTA only.
 */

import { COMPETITION_STAGE } from "../constants.js";
import { competitionStageFromRemaining } from "./teamStageTieBreakPolicy.js";

export const QUALIFIERS_POWER_OF_TWO = Object.freeze([2, 4, 8, 16]);

export const QUALIFICATION_INVALID_CODE = "INVALID_QUALIFICATION_TOTAL";
export const ONE_GROUP_NO_KNOCKOUT_CODE = "ONE_GROUP_NO_KNOCKOUT";

/**
 * Read qualifiers-per-group from settings (Owner name) with legacy alias.
 * @param {object} [settings]
 */
export function readQualifiersPerGroup(settings = {}) {
  const raw =
    settings.qualifiersPerGroup != null
      ? settings.qualifiersPerGroup
      : settings.qualificationCount;
  const n = Math.max(1, Math.floor(Number(raw) || 2));
  return n;
}

/**
 * @param {object} [settings]
 * @param {{ groupCountOverride?: number }} [opts]
 */
export function readGroupCount(settings = {}, opts = {}) {
  if (opts.groupCountOverride != null) {
    return Math.max(1, Math.floor(Number(opts.groupCountOverride) || 1));
  }
  const n = Math.floor(Number(settings.groupCount) || 1);
  return Math.max(1, n);
}

/**
 * @param {number} groupCount
 * @param {number} qualifiersPerGroup
 */
export function deriveTotalQualifiedTeams(groupCount, qualifiersPerGroup) {
  return Math.max(0, Number(groupCount) || 0) * Math.max(0, Number(qualifiersPerGroup) || 0);
}

/**
 * Map total qualified teams → first elimination COMPETITION_STAGE key.
 * 16→round_of_16, 8→quarterfinal, 4→semifinal, 2→final
 * (same remaining-after-round identity as #416: remaining = total/2 after first round starts,
 *  but Owner maps by teams IN the round = totalQualified).
 */
export function deriveFirstEliminationStage(totalQualifiedTeams) {
  const total = Number(totalQualifiedTeams);
  if (total === 16) return COMPETITION_STAGE.ROUND_OF_16;
  if (total === 8) return COMPETITION_STAGE.QUARTERFINAL;
  if (total === 4) return COMPETITION_STAGE.SEMIFINAL;
  if (total === 2) return COMPETITION_STAGE.FINAL;
  // Align with remaining-team helper when total is power-of-two size of first round:
  // remaining after round 0 materialization uses bracketSize = total.
  return competitionStageFromRemaining(total / 2) || "";
}

export function isPowerOfTwoQualifiedTotal(total) {
  return QUALIFIERS_POWER_OF_TWO.includes(Number(total));
}

/**
 * Vietnamese CTA for generating the first knockout round (coarse stage stays knockout).
 */
export function progressionCtaLabelVi(resolvedRound) {
  switch (String(resolvedRound || "").trim()) {
    case COMPETITION_STAGE.ROUND_OF_16:
      return "Tạo Vòng 16";
    case COMPETITION_STAGE.QUARTERFINAL:
      return "Tạo Tứ kết";
    case COMPETITION_STAGE.SEMIFINAL:
      return "Tạo Bán kết";
    case COMPETITION_STAGE.FINAL:
      return "Tạo Chung kết";
    default:
      return "Tạo nhánh knockout";
  }
}

export function competitionStageLabelVi(resolvedRound) {
  switch (String(resolvedRound || "").trim()) {
    case COMPETITION_STAGE.GROUP:
      return "Vòng bảng";
    case COMPETITION_STAGE.ROUND_OF_16:
      return "Vòng 16";
    case COMPETITION_STAGE.QUARTERFINAL:
      return "Tứ kết";
    case COMPETITION_STAGE.SEMIFINAL:
      return "Bán kết";
    case COMPETITION_STAGE.FINAL:
      return "Chung kết";
    default:
      return String(resolvedRound || "");
  }
}

/**
 * Full setup derivation + validation for multi-group progression.
 * One group: knockout not required / not offered.
 */
export function resolveQualificationProgression(settings = {}, opts = {}) {
  const groupCount = readGroupCount(settings, opts);
  const qualifiersPerGroup = readQualifiersPerGroup(settings);
  const totalQualifiedTeams = deriveTotalQualifiedTeams(groupCount, qualifiersPerGroup);
  const oneGroup = groupCount <= 1;

  if (oneGroup) {
    return {
      ok: true,
      groupCount,
      qualifiersPerGroup,
      totalQualifiedTeams: 0,
      oneGroup: true,
      allowsKnockout: false,
      firstEliminationStage: "",
      ctaLabelVi: "",
      code: ONE_GROUP_NO_KNOCKOUT_CODE,
    };
  }

  if (!isPowerOfTwoQualifiedTotal(totalQualifiedTeams)) {
    return {
      ok: false,
      groupCount,
      qualifiersPerGroup,
      totalQualifiedTeams,
      oneGroup: false,
      allowsKnockout: false,
      firstEliminationStage: "",
      ctaLabelVi: "",
      code: QUALIFICATION_INVALID_CODE,
      error:
        `Tổng đội vượt bảng (${totalQualifiedTeams} = ${groupCount}×${qualifiersPerGroup}) ` +
        "phải thuộc {2,4,8,16}. Bye cloud chưa được hỗ trợ — đổi groupCount hoặc số đội vượt bảng.",
    };
  }

  const firstEliminationStage = deriveFirstEliminationStage(totalQualifiedTeams);
  return {
    ok: true,
    groupCount,
    qualifiersPerGroup,
    totalQualifiedTeams,
    oneGroup: false,
    allowsKnockout: true,
    firstEliminationStage,
    ctaLabelVi: progressionCtaLabelVi(firstEliminationStage),
    code: null,
    error: null,
  };
}
