/**
 * Canonical Competition Rules Profile — domain model + normalization.
 * Policy/configuration only. No scoring/standings/referee/court execution.
 */

import {
  COMPETITION_RULES_PROFILE_SCHEMA_V1,
  COMPETITION_RULES_DOMAIN_VERSION,
} from "../constants/versions.js";
import {
  COMPETITION_UNIT_KIND,
  REGISTRATION_UNIT_KIND,
  SCORING_METHOD,
  MATCH_SERIES,
  GROUP_SIZING_POLICY,
  ROUND_ROBIN_POLICY,
  KNOCKOUT_PAIRING_POLICY,
  IN_GROUP_TIEBREAK_CRITERION,
  CROSS_GROUP_RANKING_CRITERION,
  WITHDRAWAL_HANDLING,
  NO_CHECK_IN_POLICY,
  REFEREE_REQUIREMENT,
  REFEREE_FALLBACK_POLICY,
  PUBLICATION_POLICY,
  RULE_CLASS,
  deriveKnockoutEntryRound,
  matchSeriesToBestOfGames,
} from "../constants/enums.js";
import {
  COMPETITION_RULES_STAGE,
  isCompetitionRulesStage,
} from "../constants/stages.js";
import {
  LIFECYCLE_MILESTONE,
} from "../constants/lifecycleMilestones.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function freezeDeep(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => freezeDeep(item)));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = freezeDeep(value[key]);
    }
    return Object.freeze(out);
  }
  return value;
}

function positiveIntOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function nonNegIntOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function enumOr(value, allowed, fallback) {
  const raw = value == null ? "" : String(value).trim().toUpperCase();
  if (Object.values(allowed).includes(raw)) return raw;
  // Accept lowercase aliases for scoring methods already used in Team policy
  if (raw === "RALLY" || String(value).trim().toLowerCase() === "rally") {
    if (Object.values(allowed).includes(SCORING_METHOD.RALLY)) {
      return SCORING_METHOD.RALLY;
    }
  }
  if (
    raw === "SIDE_OUT" ||
    raw === "SIDEOUT" ||
    String(value).trim().toLowerCase() === "traditional"
  ) {
    if (Object.values(allowed).includes(SCORING_METHOD.SIDE_OUT)) {
      return SCORING_METHOD.SIDE_OUT;
    }
  }
  return fallback;
}

function boolOr(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

/** Default stage lock map — which rule classes lock at which milestone. */
export const DEFAULT_LIFECYCLE_LOCK_MAP = Object.freeze({
  [RULE_CLASS.COMPETITION_UNIT]: LIFECYCLE_MILESTONE.AFTER_REGISTRATION_EXISTS,
  [RULE_CLASS.ELIGIBILITY]: LIFECYCLE_MILESTONE.AFTER_PARTICIPANTS_FINALIZED,
  [RULE_CLASS.GROUP_ALLOCATION]: LIFECYCLE_MILESTONE.AFTER_GROUP_DRAW,
  [RULE_CLASS.GROUP_FORMAT]: LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION,
  [RULE_CLASS.SCORING_FORMAT]: LIFECYCLE_MILESTONE.AFTER_MATCH_START,
  [RULE_CLASS.CHANGE_END]: LIFECYCLE_MILESTONE.AFTER_MATCH_START,
  [RULE_CLASS.QUALIFICATION]: LIFECYCLE_MILESTONE.AFTER_ACCEPTED_RESULT,
  [RULE_CLASS.WILDCARD]: LIFECYCLE_MILESTONE.AFTER_ACCEPTED_RESULT,
  [RULE_CLASS.TIEBREAK]: LIFECYCLE_MILESTONE.AFTER_ACCEPTED_RESULT,
  [RULE_CLASS.KNOCKOUT]: LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION,
  [RULE_CLASS.WALKOVER]: LIFECYCLE_MILESTONE.AFTER_ACCEPTED_RESULT,
  [RULE_CLASS.CHECK_IN]: LIFECYCLE_MILESTONE.AFTER_MATCH_START,
  [RULE_CLASS.SCHEDULE]: LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION,
  [RULE_CLASS.COURT]: LIFECYCLE_MILESTONE.AFTER_MATCH_CREATION,
  [RULE_CLASS.REFEREE]: LIFECYCLE_MILESTONE.AFTER_MATCH_START,
  [RULE_CLASS.PUBLICATION]: LIFECYCLE_MILESTONE.AFTER_ACCEPTED_RESULT,
});

export function createDefaultMatchScoringPolicy(overrides = {}) {
  return {
    scoringMethod: enumOr(
      overrides.scoringMethod,
      SCORING_METHOD,
      SCORING_METHOD.RALLY
    ),
    matchSeries: enumOr(
      overrides.matchSeries,
      MATCH_SERIES,
      MATCH_SERIES.BEST_OF_1
    ),
    targetPoints: positiveIntOrNull(overrides.targetPoints) ?? 21,
    winCondition: {
      winByEnabled: boolOr(overrides.winCondition?.winByEnabled, true),
      winByMargin:
        positiveIntOrNull(overrides.winCondition?.winByMargin) ?? 2,
      pointCapEnabled: boolOr(overrides.winCondition?.pointCapEnabled, false),
      pointCap: positiveIntOrNull(overrides.winCondition?.pointCap),
    },
    changeEnd: {
      changeEndsEnabled: boolOr(overrides.changeEnd?.changeEndsEnabled, false),
      changeEndsAtPoints: positiveIntOrNull(
        overrides.changeEnd?.changeEndsAtPoints
      ),
      changeEndsBetweenGames: boolOr(
        overrides.changeEnd?.changeEndsBetweenGames,
        true
      ),
      decidingGameChangeEndsAt: positiveIntOrNull(
        overrides.changeEnd?.decidingGameChangeEndsAt
      ),
    },
  };
}

export function createDefaultCompetitionUnit(overrides = {}) {
  return {
    competitionUnitKind: enumOr(
      overrides.competitionUnitKind,
      COMPETITION_UNIT_KIND,
      COMPETITION_UNIT_KIND.DOUBLES
    ),
    registrationUnitKind: enumOr(
      overrides.registrationUnitKind,
      REGISTRATION_UNIT_KIND,
      REGISTRATION_UNIT_KIND.PAIR
    ),
    minParticipants: positiveIntOrNull(overrides.minParticipants),
    maxParticipants: positiveIntOrNull(overrides.maxParticipants),
  };
}

export function createDefaultGroupStagePolicy(overrides = {}) {
  return {
    groupStageEnabled: boolOr(overrides.groupStageEnabled, true),
    groupCount: positiveIntOrNull(overrides.groupCount) ?? 4,
    groupSizingPolicy: enumOr(
      overrides.groupSizingPolicy,
      GROUP_SIZING_POLICY,
      GROUP_SIZING_POLICY.FIXED_GROUP_COUNT
    ),
    roundRobinPolicy: enumOr(
      overrides.roundRobinPolicy,
      ROUND_ROBIN_POLICY,
      ROUND_ROBIN_POLICY.SINGLE
    ),
    allowUnevenGroups: boolOr(overrides.allowUnevenGroups, true),
  };
}

export function createDefaultQualificationPolicy(overrides = {}) {
  return {
    totalQualifiers: positiveIntOrNull(overrides.totalQualifiers) ?? 8,
    directQualifiersPerGroup:
      positiveIntOrNull(overrides.directQualifiersPerGroup) ?? 2,
  };
}

export function createDefaultInGroupTieBreakPolicy(overrides = {}) {
  const criteria = Array.isArray(overrides.criteria)
    ? overrides.criteria.map((c) => String(c).trim().toUpperCase())
    : [
        IN_GROUP_TIEBREAK_CRITERION.MATCH_WINS,
        IN_GROUP_TIEBREAK_CRITERION.HEAD_TO_HEAD,
        IN_GROUP_TIEBREAK_CRITERION.POINT_DIFFERENTIAL,
        IN_GROUP_TIEBREAK_CRITERION.POINTS_SCORED,
        IN_GROUP_TIEBREAK_CRITERION.DRAW_LOTS,
      ];
  return {
    criteria,
    multiWayRequiresMiniTable: boolOr(
      overrides.multiWayRequiresMiniTable,
      true
    ),
  };
}

export function createDefaultCrossGroupRankingPolicy(overrides = {}) {
  const criteria = Array.isArray(overrides.criteria)
    ? overrides.criteria.map((c) => String(c).trim().toUpperCase())
    : [
        CROSS_GROUP_RANKING_CRITERION.WIN_PERCENTAGE,
        CROSS_GROUP_RANKING_CRITERION.POINT_DIFFERENTIAL_PER_MATCH,
        CROSS_GROUP_RANKING_CRITERION.POINTS_SCORED_PER_MATCH,
        CROSS_GROUP_RANKING_CRITERION.DRAW_LOTS,
      ];
  return {
    criteria,
    normalizeByMatchesPlayed: boolOr(
      overrides.normalizeByMatchesPlayed,
      true
    ),
  };
}

export function createDefaultKnockoutPolicy(overrides = {}) {
  const qualifierCount = positiveIntOrNull(overrides.qualifierCount) ?? 8;
  return {
    knockoutEnabled: boolOr(overrides.knockoutEnabled, true),
    qualifierCount,
    entryRound:
      overrides.entryRound ||
      deriveKnockoutEntryRound(qualifierCount) ||
      null,
    pairingPolicy: enumOr(
      overrides.pairingPolicy,
      KNOCKOUT_PAIRING_POLICY,
      KNOCKOUT_PAIRING_POLICY.CROSS_GROUP
    ),
    avoidSameGroupFirstRound: boolOr(
      overrides.avoidSameGroupFirstRound,
      true
    ),
  };
}

export function createDefaultWalkoverPolicy(overrides = {}) {
  return {
    walkoverPolicy: overrides.walkoverPolicy || "STANDARD_WALKOVER",
    lateArrivalPolicy: {
      enabled: boolOr(overrides.lateArrivalPolicy?.enabled, true),
      thresholdMinutes:
        positiveIntOrNull(overrides.lateArrivalPolicy?.thresholdMinutes) ?? 15,
    },
    retiredMatchPolicy: overrides.retiredMatchPolicy || "RETIRED_AS_LOSS",
    withdrawalPolicy: enumOr(
      overrides.withdrawalPolicy,
      WITHDRAWAL_HANDLING,
      WITHDRAWAL_HANDLING.KEEP_COMPLETED_AND_WO_REMAINING
    ),
  };
}

export function createDefaultCheckInPolicy(overrides = {}) {
  return {
    checkInRequired: boolOr(overrides.checkInRequired, false),
    checkInCloseMinutesBeforeStart:
      nonNegIntOrNull(overrides.checkInCloseMinutesBeforeStart) ?? 30,
    noCheckInPolicy: enumOr(
      overrides.noCheckInPolicy,
      NO_CHECK_IN_POLICY,
      NO_CHECK_IN_POLICY.WARN
    ),
  };
}

export function createDefaultScheduleConstraintPolicy(overrides = {}) {
  return {
    estimatedMatchDurationMinutes:
      positiveIntOrNull(overrides.estimatedMatchDurationMinutes) ?? 45,
    minimumRestMinutes:
      nonNegIntOrNull(overrides.minimumRestMinutes) ?? 15,
    stageScheduleWindows: isPlainObject(overrides.stageScheduleWindows)
      ? { ...overrides.stageScheduleWindows }
      : {},
  };
}

export function createDefaultCourtRequirementPolicy(overrides = {}) {
  const physicalCourtIds = Array.isArray(overrides.physicalCourtIds)
    ? overrides.physicalCourtIds.map(String)
    : [];
  return {
    venueId: overrides.venueId == null ? null : String(overrides.venueId),
    facilityClusterId:
      overrides.facilityClusterId == null
        ? null
        : String(overrides.facilityClusterId),
    physicalCourtIds,
    stageCourtRequirements: isPlainObject(overrides.stageCourtRequirements)
      ? { ...overrides.stageCourtRequirements }
      : {},
  };
}

export function createDefaultRefereeRequirementPolicy(overrides = {}) {
  const byStage = isPlainObject(overrides.byStage) ? { ...overrides.byStage } : {};
  const defaults = {
    [COMPETITION_RULES_STAGE.GROUP]: REFEREE_REQUIREMENT.OPTIONAL,
    [COMPETITION_RULES_STAGE.QUARTERFINAL]: REFEREE_REQUIREMENT.REQUIRED,
    [COMPETITION_RULES_STAGE.SEMIFINAL]: REFEREE_REQUIREMENT.REQUIRED,
    [COMPETITION_RULES_STAGE.FINAL]: REFEREE_REQUIREMENT.REQUIRED,
  };
  return {
    byStage: { ...defaults, ...byStage },
    fallbackPolicy: enumOr(
      overrides.fallbackPolicy,
      REFEREE_FALLBACK_POLICY,
      REFEREE_FALLBACK_POLICY.BLOCK_START
    ),
  };
}

export function createDefaultPublicationPolicy(overrides = {}) {
  return {
    standingsPublicationPolicy: enumOr(
      overrides.standingsPublicationPolicy,
      PUBLICATION_POLICY,
      PUBLICATION_POLICY.AFTER_ACCEPTED_RESULT
    ),
    schedulePublicationPolicy: enumOr(
      overrides.schedulePublicationPolicy,
      PUBLICATION_POLICY,
      PUBLICATION_POLICY.DIRECTOR_APPROVAL
    ),
    resultsPublicationPolicy: enumOr(
      overrides.resultsPublicationPolicy,
      PUBLICATION_POLICY,
      PUBLICATION_POLICY.AFTER_ACCEPTED_RESULT
    ),
  };
}

export function createDefaultLifecycleLockPolicy(overrides = {}) {
  return {
    lockMap: {
      ...DEFAULT_LIFECYCLE_LOCK_MAP,
      ...(isPlainObject(overrides.lockMap) ? overrides.lockMap : {}),
    },
  };
}

/**
 * Normalize stage override map. Unknown stages are dropped (fail later in validate if present in raw).
 * @param {unknown} raw
 * @returns {Record<string, object>}
 */
export function normalizeStageOverrides(raw) {
  if (!isPlainObject(raw)) return {};
  const out = {};
  for (const [stage, entry] of Object.entries(raw)) {
    if (!isCompetitionRulesStage(stage)) continue;
    if (!isPlainObject(entry)) continue;
    const base = createDefaultMatchScoringPolicy(entry);
    out[stage] = {
      ...base,
      refereeRequirement: entry.refereeRequirement
        ? enumOr(entry.refereeRequirement, REFEREE_REQUIREMENT, null)
        : undefined,
      estimatedMatchDurationMinutes: positiveIntOrNull(
        entry.estimatedMatchDurationMinutes
      ),
    };
  }
  return out;
}

/**
 * Create a deterministic, frozen Competition Rules Profile.
 * @param {object} [raw]
 * @returns {Readonly<object>}
 */
export function createCompetitionRulesProfile(raw = {}) {
  const source = isPlainObject(raw) ? raw : {};
  const matchScoring = createDefaultMatchScoringPolicy(
    source.matchScoring || source.scoring || {}
  );
  const groupStage = createDefaultGroupStagePolicy(source.groupStage || {});
  const qualification = createDefaultQualificationPolicy(
    source.qualification || {}
  );
  const knockout = createDefaultKnockoutPolicy({
    ...(source.knockout || {}),
    qualifierCount:
      source.knockout?.qualifierCount ?? qualification.totalQualifiers,
  });

  const profile = {
    schemaVersion: COMPETITION_RULES_PROFILE_SCHEMA_V1,
    domainVersion: COMPETITION_RULES_DOMAIN_VERSION,
    profileId:
      source.profileId == null ? null : String(source.profileId),
    tenantId: source.tenantId == null ? null : String(source.tenantId),
    competitionId:
      source.competitionId == null ? null : String(source.competitionId),
    competitionUnit: createDefaultCompetitionUnit(
      source.competitionUnit || {}
    ),
    matchScoring,
    stageOverrides: normalizeStageOverrides(source.stageOverrides),
    groupStage,
    qualification,
    inGroupTieBreak: createDefaultInGroupTieBreakPolicy(
      source.inGroupTieBreak || {}
    ),
    crossGroupRanking: createDefaultCrossGroupRankingPolicy(
      source.crossGroupRanking || {}
    ),
    knockout,
    walkover: createDefaultWalkoverPolicy(source.walkover || {}),
    checkIn: createDefaultCheckInPolicy(source.checkIn || {}),
    scheduleConstraints: createDefaultScheduleConstraintPolicy(
      source.scheduleConstraints || {}
    ),
    courtRequirement: createDefaultCourtRequirementPolicy(
      source.courtRequirement || {}
    ),
    refereeRequirement: createDefaultRefereeRequirementPolicy(
      source.refereeRequirement || {}
    ),
    publication: createDefaultPublicationPolicy(source.publication || {}),
    lifecycleLocks: createDefaultLifecycleLockPolicy(
      source.lifecycleLocks || {}
    ),
    metadata: isPlainObject(source.metadata) ? { ...source.metadata } : {},
  };

  return freezeDeep(profile);
}

/**
 * Project match scoring policy toward CORE-16 ScoringFormat-compatible shape.
 * Does not invoke CORE-16 engine — policy projection only.
 * @param {object} matchScoring
 * @returns {object}
 */
export function projectMatchScoringToCore16Shape(matchScoring) {
  const scoring = createDefaultMatchScoringPolicy(matchScoring || {});
  const bestOfGames = matchSeriesToBestOfGames(scoring.matchSeries) ?? 1;
  return Object.freeze({
    scoringSystem: scoring.scoringMethod,
    pointsToWin: scoring.targetPoints,
    winBy: scoring.winCondition.winByEnabled
      ? scoring.winCondition.winByMargin
      : 1,
    maximumScore: scoring.winCondition.pointCapEnabled
      ? scoring.winCondition.pointCap
      : null,
    bestOfGames,
    sideSwitchAt: scoring.changeEnd.changeEndsEnabled
      ? scoring.changeEnd.changeEndsAtPoints
      : null,
  });
}
