/**
 * Capability truth resolution — policy vs execution axes.
 *
 * POLICY REPRESENTABLE ≠ CAPABILITY CONFIGURED/REQUESTED ≠ EXECUTION AVAILABLE.
 * Default schema objects must not imply configured demand.
 */

import {
  CAPABILITY_STATE,
  COMPETITION_RULES_CAPABILITY_ID,
  COMPETITION_RULES_CAPABILITY_MATRIX,
} from "../constants/capability.js";
import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import {
  SCORING_METHOD,
  MATCH_SERIES,
} from "../constants/enums.js";
import { createCompetitionRulesProfile } from "../domain/competitionRulesProfile.js";
import { deriveQualificationPlan } from "./deriveQualificationPlan.js";

/**
 * Semantic demand for cross-group wildcard ranking execution.
 * Not configured merely because profile.crossGroupRanking defaults exist.
 *
 * Required when group stage is on AND qualification yields wildcardSlots > 0
 * (those slots are selected by ranking across groups).
 *
 * @param {object} profile normalized competition rules profile
 * @returns {{ configured: boolean, groupStageEnabled: boolean, wildcardSlots: number, qualificationPlanOk: boolean }}
 */
export function resolveCrossGroupWildcardRankingDemand(profile) {
  const qualificationPlan = deriveQualificationPlan({
    groupCount: profile.groupStage.groupCount,
    totalKnockoutSlots: profile.qualification.totalKnockoutSlots,
    totalQualifiers: profile.qualification.totalQualifiers,
    directQualifiersPerGroup: profile.qualification.directQualifiersPerGroup,
    directKnockoutEntryCount: profile.qualification.directKnockoutEntryCount,
    groupStageEnabled: profile.groupStage.groupStageEnabled,
  });
  const groupStageEnabled = profile.groupStage.groupStageEnabled === true;
  const wildcardSlots =
    qualificationPlan.ok === true ? Number(qualificationPlan.wildcardSlots) || 0 : 0;
  const configured = groupStageEnabled === true && wildcardSlots > 0;
  return Object.freeze({
    configured,
    groupStageEnabled,
    wildcardSlots,
    qualificationPlanOk: qualificationPlan.ok === true,
    requiresCrossGroupWildcardRanking: configured,
    requiredCondition:
      "groupStageEnabled === true && deriveQualificationPlan(...).wildcardSlots > 0",
  });
}

/**
 * @param {string} capabilityId
 */
export function resolveCapabilityState(capabilityId) {
  const id = String(capabilityId || "").trim();
  const entry = COMPETITION_RULES_CAPABILITY_MATRIX[id];
  if (!entry) {
    return Object.freeze({
      ok: false,
      capabilityId: id,
      code: COMPETITION_RULES_ERROR_CODE.CAPABILITY_UNSUPPORTED,
      message: `Unknown capability: ${id}`,
      policy: CAPABILITY_STATE.UNSUPPORTED,
      execution: CAPABILITY_STATE.UNSUPPORTED,
    });
  }
  return Object.freeze({
    ok: true,
    capabilityId: id,
    policy: entry.policy,
    execution: entry.execution,
    evidence: entry.evidence,
    executionCondition: entry.executionCondition || null,
    supportedRuntimePaths: entry.supportedRuntimePaths || null,
    unsupportedOrHintOnlyPaths: entry.unsupportedOrHintOnlyPaths || null,
    operational:
      entry.policy === CAPABILITY_STATE.SUPPORTED &&
      (entry.execution === CAPABILITY_STATE.SUPPORTED ||
        entry.execution === CAPABILITY_STATE.PARTIAL),
    fakeSupportCreated: false,
  });
}

/**
 * Resolve capability truth for a concrete profile configuration.
 * Fail-closed: configuration that is policy-valid but execution-deferred is reported honestly.
 * Deferred optional capabilities do not mark unrelated profiles as blocked.
 * @param {object} [profileOrRaw]
 */
export function resolveProfileCapabilityState(profileOrRaw) {
  const profile = createCompetitionRulesProfile(profileOrRaw);
  const features = [];

  const push = (capabilityId, configured) => {
    const state = resolveCapabilityState(capabilityId);
    features.push(
      Object.freeze({
        capabilityId,
        configured: configured === true,
        ...state,
      })
    );
  };

  push(
    COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_RALLY,
    profile.matchScoring.scoringMethod === SCORING_METHOD.RALLY
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_SIDE_OUT,
    profile.matchScoring.scoringMethod === SCORING_METHOD.SIDE_OUT
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_1,
    profile.matchScoring.matchSeries === MATCH_SERIES.BEST_OF_1
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_3,
    profile.matchScoring.matchSeries === MATCH_SERIES.BEST_OF_3
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_5,
    profile.matchScoring.matchSeries === MATCH_SERIES.BEST_OF_5
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.WIN_BY,
    profile.matchScoring.winCondition.winByEnabled === true
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.CHANGE_END,
    profile.matchScoring.changeEnd.changeEndsEnabled === true
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.QUALIFICATION_WILDCARD,
    profile.groupStage.groupStageEnabled === true
  );
  push(COMPETITION_RULES_CAPABILITY_ID.IN_GROUP_TIEBREAK, true);

  const crossGroupDemand = resolveCrossGroupWildcardRankingDemand(profile);
  push(
    COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING,
    crossGroupDemand.configured
  );

  push(
    COMPETITION_RULES_CAPABILITY_ID.KNOCKOUT,
    profile.knockout.knockoutEnabled === true
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.GROUP_STAGE_BYPASS,
    profile.knockoutAdmission?.groupStageBypass?.enabled === true ||
      (profile.knockoutAdmission?.groupStageBypass?.entrants || []).length > 0
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.DIRECT_KNOCKOUT_ENTRY,
    profile.knockoutAdmission?.directKnockoutEntry?.enabled === true ||
      Number(profile.qualification?.directKnockoutEntryCount) > 0
  );
  push(
    COMPETITION_RULES_CAPABILITY_ID.KNOCKOUT_BYE,
    profile.knockout.knockoutEnabled === true
  );
  push(COMPETITION_RULES_CAPABILITY_ID.LIFECYCLE_LOCK, true);

  const blockedConfigured = features.filter(
    (f) =>
      f.configured &&
      (f.execution === CAPABILITY_STATE.UNSUPPORTED ||
        f.execution === CAPABILITY_STATE.DEFERRED)
  );

  return Object.freeze({
    ok: true,
    features: Object.freeze(features),
    blockedConfigured: Object.freeze(blockedConfigured),
    crossGroupWildcardRankingDemand: crossGroupDemand,
    unsupportedFeaturePolicy: "FAIL_CLOSED_NO_FAKE_SUCCESS",
    fakeSupportCreated: false,
  });
}

export { COMPETITION_RULES_CAPABILITY_ID, CAPABILITY_STATE };
