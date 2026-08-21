/**
 * Fail-closed validation for Canonical Competition Rules Profile.
 */

import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import {
  SCORING_METHOD,
  MATCH_SERIES,
  IN_GROUP_TIEBREAK_CRITERION,
  CROSS_GROUP_RANKING_CRITERION,
  KNOCKOUT_PAIRING_POLICY,
  RULE_CLASS,
  deriveKnockoutEntryRound,
  matchSeriesToBestOfGames,
} from "../constants/enums.js";
import { isCompetitionRulesStage } from "../constants/stages.js";
import {
  CAPABILITY_STATE,
  COMPETITION_RULES_CAPABILITY_ID,
  COMPETITION_RULES_CAPABILITY_MATRIX,
} from "../constants/capability.js";
import { createCompetitionRulesProfile } from "../domain/competitionRulesProfile.js";
import { deriveQualificationPlan } from "./deriveQualificationPlan.js";

function issue(code, message, details = {}) {
  return Object.freeze({ code, message, details: Object.freeze({ ...details }) });
}

function capabilityExecution(id) {
  return COMPETITION_RULES_CAPABILITY_MATRIX[id]?.execution;
}

/**
 * @param {unknown} raw
 * @param {{ requireTenant?: boolean, requireCompetition?: boolean, enforceExecutionCapability?: boolean }} [options]
 */
export function validateCompetitionRulesProfile(raw, options = {}) {
  const issues = [];
  const profile = createCompetitionRulesProfile(raw);

  if (options.requireTenant !== false && !profile.tenantId) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.TENANT_REQUIRED,
        "tenantId is required for competition rules profile",
        {}
      )
    );
  }
  if (options.requireCompetition !== false && !profile.competitionId) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.COMPETITION_REQUIRED,
        "competitionId is required for competition rules profile",
        {}
      )
    );
  }

  const scoring = profile.matchScoring;
  if (!Object.values(SCORING_METHOD).includes(scoring.scoringMethod)) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_SCORING_POLICY,
        "Unknown scoringMethod",
        { scoringMethod: scoring.scoringMethod }
      )
    );
  }
  if (!Object.values(MATCH_SERIES).includes(scoring.matchSeries)) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_SCORING_POLICY,
        "Unknown matchSeries",
        { matchSeries: scoring.matchSeries }
      )
    );
  }
  if (matchSeriesToBestOfGames(scoring.matchSeries) == null) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_SCORING_POLICY,
        "matchSeries cannot map to bestOfGames",
        { matchSeries: scoring.matchSeries }
      )
    );
  }

  const win = scoring.winCondition;
  if (win.winByEnabled && (!win.winByMargin || win.winByMargin < 1)) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_SCORING_POLICY,
        "winByMargin must be >= 1 when winByEnabled",
        { winByMargin: win.winByMargin }
      )
    );
  }
  if (win.pointCapEnabled) {
    if (!win.pointCap || win.pointCap < scoring.targetPoints) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_SCORING_POLICY,
          "pointCap must be >= targetPoints when pointCapEnabled",
          { pointCap: win.pointCap, targetPoints: scoring.targetPoints }
        )
      );
    }
  }

  const changeEnd = scoring.changeEnd;
  if (changeEnd.changeEndsEnabled) {
    if (
      changeEnd.changeEndsAtPoints != null &&
      changeEnd.changeEndsAtPoints >= scoring.targetPoints
    ) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_CHANGE_END,
          "changeEndsAtPoints must be < targetPoints",
          {
            changeEndsAtPoints: changeEnd.changeEndsAtPoints,
            targetPoints: scoring.targetPoints,
          }
        )
      );
    }
  }

  // Stage overrides — reject unknown stages from raw input
  if (raw && typeof raw === "object" && raw.stageOverrides) {
    for (const stage of Object.keys(raw.stageOverrides)) {
      if (!isCompetitionRulesStage(stage)) {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.UNKNOWN_STAGE,
            `Unknown stage override: ${stage}`,
            { stage }
          )
        );
      }
    }
  }

  for (const [stage, entry] of Object.entries(profile.stageOverrides)) {
    if (
      entry.changeEnd?.changeEndsEnabled &&
      entry.changeEnd.changeEndsAtPoints != null &&
      entry.changeEnd.changeEndsAtPoints >= entry.targetPoints
    ) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_STAGE_OVERRIDE,
          `Stage ${stage}: changeEndsAtPoints must be < targetPoints`,
          { stage }
        )
      );
    }
  }

  const group = profile.groupStage;
  if (group.groupStageEnabled && (!group.groupCount || group.groupCount < 1)) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_GROUP_CONFIG,
        "groupCount must be >= 1 when groupStageEnabled",
        { groupCount: group.groupCount }
      )
    );
  }

  const qualPlan = deriveQualificationPlan({
    groupCount: group.groupStageEnabled ? group.groupCount : 0,
    totalQualifiers: profile.qualification.totalQualifiers,
    directQualifiersPerGroup: profile.qualification.directQualifiersPerGroup,
    groupStageEnabled: group.groupStageEnabled,
  });
  if (!qualPlan.ok) {
    issues.push(
      issue(qualPlan.code, qualPlan.message, qualPlan.details || {})
    );
  }

  const allowedInGroup = new Set(Object.values(IN_GROUP_TIEBREAK_CRITERION));
  if (
    !Array.isArray(profile.inGroupTieBreak.criteria) ||
    profile.inGroupTieBreak.criteria.length === 0
  ) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_TIEBREAK,
        "inGroupTieBreak.criteria must be a non-empty ordered list",
        {}
      )
    );
  } else {
    for (const c of profile.inGroupTieBreak.criteria) {
      if (!allowedInGroup.has(c)) {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.INVALID_TIEBREAK,
            `Unknown in-group tie-break criterion: ${c}`,
            { criterion: c }
          )
        );
      }
    }
  }

  const allowedCross = new Set(Object.values(CROSS_GROUP_RANKING_CRITERION));
  for (const c of profile.crossGroupRanking.criteria) {
    if (!allowedCross.has(c)) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_WILDCARD_RANKING,
          `Unknown cross-group ranking criterion: ${c}`,
          { criterion: c }
        )
      );
    }
  }
  if (
    qualPlan.ok &&
    qualPlan.wildcardSlots > 0 &&
    !profile.crossGroupRanking.normalizeByMatchesPlayed
  ) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_WILDCARD_RANKING,
        "normalizeByMatchesPlayed must be true when wildcard slots exist (unequal groups)",
        { wildcardSlots: qualPlan.wildcardSlots }
      )
    );
  }

  const ko = profile.knockout;
  if (ko.knockoutEnabled) {
    if (!ko.qualifierCount || ko.qualifierCount < 2) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT,
          "qualifierCount must be >= 2 when knockoutEnabled",
          { qualifierCount: ko.qualifierCount }
        )
      );
    } else {
      const entry = deriveKnockoutEntryRound(ko.qualifierCount);
      if (!entry) {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT,
            "qualifierCount must be a power-of-two bracket size (2/4/8/16/32)",
            { qualifierCount: ko.qualifierCount }
          )
        );
      }
      if (
        group.groupStageEnabled &&
        qualPlan.ok &&
        ko.qualifierCount !== profile.qualification.totalQualifiers
      ) {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT,
            "knockout.qualifierCount must equal qualification.totalQualifiers",
            {
              qualifierCount: ko.qualifierCount,
              totalQualifiers: profile.qualification.totalQualifiers,
            }
          )
        );
      }
    }
    if (!Object.values(KNOCKOUT_PAIRING_POLICY).includes(ko.pairingPolicy)) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_KNOCKOUT,
          "Unknown knockout pairingPolicy",
          { pairingPolicy: ko.pairingPolicy }
        )
      );
    }
  }

  if (
    profile.checkIn.checkInRequired &&
    profile.checkIn.checkInCloseMinutesBeforeStart == null
  ) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_CHECK_IN,
        "checkInCloseMinutesBeforeStart required when checkInRequired",
        {}
      )
    );
  }

  if (
    !profile.scheduleConstraints.estimatedMatchDurationMinutes ||
    profile.scheduleConstraints.estimatedMatchDurationMinutes < 1
  ) {
    issues.push(
      issue(
        COMPETITION_RULES_ERROR_CODE.INVALID_SCHEDULE,
        "estimatedMatchDurationMinutes must be >= 1",
        {}
      )
    );
  }

  // Court requirement: physicalCourtIds must be strings (canonical court ids) — no club_data_v3
  for (const id of profile.courtRequirement.physicalCourtIds) {
    if (typeof id !== "string" || !id.trim()) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_COURT_REQUIREMENT,
          "physicalCourtIds must be non-empty canonical court id strings",
          { physicalCourtId: id }
        )
      );
    }
  }

  for (const [stage, req] of Object.entries(
    profile.refereeRequirement.byStage
  )) {
    if (!isCompetitionRulesStage(stage)) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_REFEREE_REQUIREMENT,
          `Unknown referee requirement stage: ${stage}`,
          { stage }
        )
      );
    }
    if (req !== "OPTIONAL" && req !== "REQUIRED") {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.INVALID_REFEREE_REQUIREMENT,
          `Invalid referee requirement for ${stage}`,
          { stage, req }
        )
      );
    }
  }

  for (const ruleClass of Object.keys(profile.lifecycleLocks.lockMap)) {
    if (!Object.values(RULE_CLASS).includes(ruleClass)) {
      issues.push(
        issue(
          COMPETITION_RULES_ERROR_CODE.UNKNOWN_RULE_CLASS,
          `Unknown rule class in lifecycle lock map: ${ruleClass}`,
          { ruleClass }
        )
      );
    }
  }

  // Execution capability fail-closed when requested
  if (options.enforceExecutionCapability === true) {
    const checks = [
      [
        scoring.scoringMethod === SCORING_METHOD.SIDE_OUT,
        COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_SIDE_OUT,
      ],
      [
        scoring.matchSeries === MATCH_SERIES.BEST_OF_3,
        COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_3,
      ],
      [
        scoring.matchSeries === MATCH_SERIES.BEST_OF_5,
        COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_5,
      ],
      [
        scoring.changeEnd.changeEndsEnabled,
        COMPETITION_RULES_CAPABILITY_ID.CHANGE_END,
      ],
      [
        qualPlan.ok === true &&
          profile.groupStage.groupStageEnabled === true &&
          Number(qualPlan.wildcardSlots) > 0,
        COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING,
      ],
    ];
    for (const [enabled, capId] of checks) {
      if (!enabled) continue;
      const exec = capabilityExecution(capId);
      if (
        exec === CAPABILITY_STATE.UNSUPPORTED ||
        exec === CAPABILITY_STATE.DEFERRED
      ) {
        issues.push(
          issue(
            COMPETITION_RULES_ERROR_CODE.CAPABILITY_EXECUTION_UNAVAILABLE,
            `Capability ${capId} is not operationally available (${exec})`,
            { capabilityId: capId, execution: exec }
          )
        );
      }
    }
  }

  const ok = issues.length === 0;
  return Object.freeze({
    ok,
    profile,
    issues: Object.freeze(issues),
    qualificationPlan: qualPlan.ok ? qualPlan : null,
  });
}
