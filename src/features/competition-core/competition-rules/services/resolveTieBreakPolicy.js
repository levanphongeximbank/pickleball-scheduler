/**
 * Map in-group / cross-group policy criteria for CORE-18 composition.
 * Policy representation only — does not calculate standings.
 */

import {
  mapInGroupCriterionToCore18,
  CROSS_GROUP_RANKING_CRITERION,
} from "../constants/enums.js";
import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import { createCompetitionRulesProfile } from "../domain/competitionRulesProfile.js";

/**
 * @param {object} [profileOrRaw]
 * @returns {{ ok: boolean, criteria: string[], core18TieBreakRules: Array<{ type: string, enabled: boolean, order: number }>, multiWayRequiresMiniTable: boolean }}
 */
export function resolveTieBreakPolicy(profileOrRaw) {
  const profile = createCompetitionRulesProfile(profileOrRaw);
  const criteria = profile.inGroupTieBreak.criteria.slice();
  /** @type {Array<{ type: string, enabled: boolean, order: number }>} */
  const core18TieBreakRules = [];
  for (const criterion of criteria) {
    const mapped = mapInGroupCriterionToCore18(criterion);
    if (mapped) {
      core18TieBreakRules.push({
        type: mapped,
        enabled: true,
        order: core18TieBreakRules.length,
      });
    }
  }
  if (
    profile.inGroupTieBreak.multiWayRequiresMiniTable &&
    !core18TieBreakRules.some((r) => r.type === "MINI_TABLE")
  ) {
    // Ensure multi-way path has mini-table available for CORE-18 composition
    core18TieBreakRules.push({
      type: "MINI_TABLE",
      enabled: true,
      order: core18TieBreakRules.length,
    });
  }
  return Object.freeze({
    ok: true,
    criteria: Object.freeze(criteria),
    core18TieBreakRules: Object.freeze(core18TieBreakRules),
    multiWayRequiresMiniTable:
      profile.inGroupTieBreak.multiWayRequiresMiniTable === true,
    executionOwner: "CORE-18",
    policyOwner: "competition-core.competition-rules",
  });
}

/**
 * @param {object} [profileOrRaw]
 * @param {{ requestAuthoritativeRanking?: boolean }} [options]
 */
export function resolveWildcardRankingPolicy(profileOrRaw, options = {}) {
  const profile = createCompetitionRulesProfile(profileOrRaw);
  const criteria = profile.crossGroupRanking.criteria.slice();
  const allowed = new Set(Object.values(CROSS_GROUP_RANKING_CRITERION));
  const unknown = criteria.filter((c) => !allowed.has(c));
  const policyOk = unknown.length === 0;
  // Policy remain representable even when execution is deferred.
  const base = Object.freeze({
    ok: policyOk,
    criteria: Object.freeze(criteria),
    normalizeByMatchesPlayed:
      profile.crossGroupRanking.normalizeByMatchesPlayed === true,
    unknown: Object.freeze(unknown),
    policyOwner: "competition-core.competition-rules",
    policyRepresentable: policyOk,
    executionAvailable: false,
    executionOwner: "CORE-18",
    executionState: "DEFERRED",
    note:
      "Normalized metrics required for unequal groups; absolute wins must not be the sole cross-group comparator. Authoritative ranking execution deferred until CORE-18 composition exists.",
  });

  if (options.requestAuthoritativeRanking === true) {
    return Object.freeze({
      ...base,
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.CAPABILITY_EXECUTION_UNAVAILABLE,
      message:
        "Authoritative cross-group wildcard ranking execution is unavailable (DEFERRED); fail-closed",
      failClosed: true,
    });
  }

  return base;
}
