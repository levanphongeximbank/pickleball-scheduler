/**
 * Stage-specific effective match rule resolution.
 */

import {
  COMPETITION_RULES_STAGE,
  isCompetitionRulesStage,
} from "../constants/stages.js";
import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import {
  createCompetitionRulesProfile,
  projectMatchScoringToCore16Shape,
} from "../domain/competitionRulesProfile.js";
import { REFEREE_REQUIREMENT } from "../constants/enums.js";

/**
 * @param {object} profileOrRaw
 * @param {string} stage
 */
export function resolveStageMatchRules(profileOrRaw, stage) {
  const profile = createCompetitionRulesProfile(profileOrRaw);
  const stageKey = String(stage || "").trim().toUpperCase();

  if (!isCompetitionRulesStage(stageKey)) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.UNKNOWN_STAGE,
      message: `Unknown competition rules stage: ${stageKey}`,
      stage: stageKey,
    });
  }

  const base = profile.matchScoring;
  const override = profile.stageOverrides[stageKey] || null;
  const effectiveScoring = override
    ? {
        scoringMethod: override.scoringMethod,
        matchSeries: override.matchSeries,
        targetPoints: override.targetPoints,
        winCondition: override.winCondition,
        changeEnd: override.changeEnd,
      }
    : {
        scoringMethod: base.scoringMethod,
        matchSeries: base.matchSeries,
        targetPoints: base.targetPoints,
        winCondition: base.winCondition,
        changeEnd: base.changeEnd,
      };

  const refereeRequirement =
    override?.refereeRequirement ||
    profile.refereeRequirement.byStage[stageKey] ||
    (stageKey === COMPETITION_RULES_STAGE.GROUP
      ? REFEREE_REQUIREMENT.OPTIONAL
      : REFEREE_REQUIREMENT.REQUIRED);

  const estimatedMatchDurationMinutes =
    override?.estimatedMatchDurationMinutes ??
    profile.scheduleConstraints.estimatedMatchDurationMinutes;

  const courtRequirement =
    profile.courtRequirement.stageCourtRequirements[stageKey] ||
    Object.freeze({
      venueId: profile.courtRequirement.venueId,
      facilityClusterId: profile.courtRequirement.facilityClusterId,
      physicalCourtIds: profile.courtRequirement.physicalCourtIds,
    });

  return Object.freeze({
    ok: true,
    stage: stageKey,
    source: override ? "stageOverride" : "baseProfile",
    matchScoring: Object.freeze(effectiveScoring),
    core16Projection: projectMatchScoringToCore16Shape(effectiveScoring),
    refereeRequirement,
    refereeFallbackPolicy: profile.refereeRequirement.fallbackPolicy,
    scheduleConstraints: Object.freeze({
      estimatedMatchDurationMinutes,
      minimumRestMinutes: profile.scheduleConstraints.minimumRestMinutes,
      stageWindow:
        profile.scheduleConstraints.stageScheduleWindows[stageKey] || null,
    }),
    courtRequirement: Object.freeze(courtRequirement),
    executionOwners: Object.freeze({
      scoring: "CORE-16",
      refereeAssignment: "CORE-13",
      schedule: "schedule-engine/CORE-11",
      courtAssignment: "CORE-12",
      physicalCourtSsot: "2.2_COURT_OPERATIONS",
      lifecycle: "CORE-15",
    }),
    policyOwners: Object.freeze({
      courtRequirement: "competition-core.competition-rules",
    }),
  });
}
