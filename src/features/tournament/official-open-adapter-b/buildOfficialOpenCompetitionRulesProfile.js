/**
 * Official/Open → competition.rules.profile.v1 translator.
 * Translation only. No persistence. No second rules SSOT.
 *
 * Persisted source (active):
 *   event.competitionRules  (official.content.competitionRules.v1)
 *
 * Legacy compatibility input (only when Content rules absent):
 *   tournament.settings.officialCompetition → LEGACY_COMPATIBILITY_DRAFT
 *
 * Precedence for effective values (via Adapter A after translation):
 *   STAGE_OVERRIDE > CONTENT_RULE > CANONICAL_SYSTEM_DEFAULT
 *
 * NO tournament-rule inheritance layer.
 */

import {
  createCompetitionRulesProfile,
  COMPETITION_RULES_PROFILE_SCHEMA_V1,
  COMPETITION_RULES_STAGE,
  SCORING_METHOD,
  MATCH_SERIES,
  COMPETITION_UNIT_KIND,
  REGISTRATION_UNIT_KIND,
  REFEREE_REQUIREMENT,
} from "../../competition-core/competition-rules/index.js";
import { EVENT_TYPE } from "../../../models/tournament/constants.js";
import { isDoubleEventType, isSingleEventType } from "../../../tournament/engines/officialTournamentEngine.js";
import {
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_ROUND_SCORE_KEY,
  CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
} from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  resolveContentCompetitionRules,
  CONTENT_RULES_SOURCE,
} from "../../individual-tournament/engines/officialContentCompetitionRules.js";

const ROUND_KEY_TO_STAGE = Object.freeze({
  [OFFICIAL_ROUND_SCORE_KEY.GROUP]: COMPETITION_RULES_STAGE.GROUP,
  [OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16]: COMPETITION_RULES_STAGE.ROUND_OF_16,
  [OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL]: COMPETITION_RULES_STAGE.QUARTERFINAL,
  [OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL]: COMPETITION_RULES_STAGE.SEMIFINAL,
  [OFFICIAL_ROUND_SCORE_KEY.FINAL]: COMPETITION_RULES_STAGE.FINAL,
});

function trim(value) {
  return value != null ? String(value).trim() : "";
}

function mapScoringMethod(officialMethod) {
  const raw = String(officialMethod || "").trim().toLowerCase();
  if (raw === OFFICIAL_SCORING_METHOD.SIDE_OUT || raw === "side-out" || raw === "side_out") {
    return SCORING_METHOD.SIDE_OUT;
  }
  return SCORING_METHOD.RALLY;
}

function mapMatchSeries(officialFormat) {
  const raw = String(officialFormat || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_");
  if (raw === OFFICIAL_MATCH_FORMAT.BEST_OF_3) return MATCH_SERIES.BEST_OF_3;
  return MATCH_SERIES.BEST_OF_1;
}

function mapCompetitionUnit(event, registrationMode) {
  const type = event?.eventType || EVENT_TYPE.MEN_DOUBLE;
  const reg =
    registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
      ? REGISTRATION_UNIT_KIND.PLAYER
      : registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR
        ? REGISTRATION_UNIT_KIND.PAIR
        : null;

  if (isSingleEventType(type)) {
    return {
      competitionUnitKind: COMPETITION_UNIT_KIND.SINGLES,
      registrationUnitKind: reg || REGISTRATION_UNIT_KIND.PLAYER,
    };
  }
  if (isDoubleEventType(type)) {
    return {
      competitionUnitKind: COMPETITION_UNIT_KIND.DOUBLES,
      registrationUnitKind: reg || REGISTRATION_UNIT_KIND.PAIR,
    };
  }
  return {
    competitionUnitKind: COMPETITION_UNIT_KIND.DOUBLES,
    registrationUnitKind: reg || REGISTRATION_UNIT_KIND.PAIR,
  };
}

function buildStageOverridesFromContent(rules) {
  const overrides = {};
  const stages = rules?.stageOverrides || {};
  for (const [stage, entry] of Object.entries(stages)) {
    if (!entry || entry.inheritBase === true) continue;
    overrides[stage] = {
      scoringMethod: mapScoringMethod(entry.scoringMethod || rules.matchScoring?.scoringMethod),
      matchSeries: mapMatchSeries(
        entry.matchSeries || entry.matchFormat || rules.matchScoring?.matchFormat
      ),
      targetPoints: Number(entry.targetPoints) || rules.matchScoring?.targetPoints,
      winCondition: {
        winByEnabled: entry.winCondition?.winByEnabled !== false,
        winByMargin: Number(entry.winCondition?.winByMargin) || 2,
        pointCapEnabled: Boolean(entry.winCondition?.pointCapEnabled),
        pointCap:
          entry.winCondition?.pointCap != null
            ? Number(entry.winCondition.pointCap)
            : null,
      },
      changeEnd: {
        changeEndsEnabled: Boolean(entry.changeEnd?.changeEndsEnabled),
        changeEndsAtPoints:
          entry.changeEnd?.changeEndsAtPoints != null
            ? Number(entry.changeEnd.changeEndsAtPoints)
            : null,
        changeEndsBetweenGames: entry.changeEnd?.changeEndsBetweenGames !== false,
        decidingGameChangeEndsAt:
          entry.changeEnd?.decidingGameChangeEndsAt != null
            ? Number(entry.changeEnd.decidingGameChangeEndsAt)
            : null,
      },
    };
  }
  // Compatibility: also accept flat roundTargets-only overrides
  if (Object.keys(overrides).length === 0) {
    for (const [roundKey, stage] of Object.entries(ROUND_KEY_TO_STAGE)) {
      const points = Number(rules?.roundTargets?.[roundKey]);
      if (Number.isFinite(points) && points >= 1) {
        overrides[stage] = { targetPoints: Math.floor(points) };
      }
    }
  }
  return overrides;
}

/**
 * Build competition.rules.profile.v1 from Content-owned rules.
 *
 * @param {object} tournament
 * @param {{ eventId?: string, lifecycleEvidence?: object, tenantId?: string }} [options]
 */
export function buildOfficialOpenCompetitionRulesProfile(tournament, options = {}) {
  const tenantId = trim(options.tenantId || tournament?.tenantId);
  const competitionId = trim(tournament?.id || tournament?.tournamentId);
  if (!tenantId) {
    return {
      ok: false,
      code: "TENANT_REQUIRED",
      error: "Thiếu tenantId — không dựng Rules Profile.",
    };
  }
  if (!competitionId) {
    return {
      ok: false,
      code: "COMPETITION_REQUIRED",
      error: "Thiếu tournamentId / competitionId.",
    };
  }

  const resolved = resolveContentCompetitionRules(tournament, {
    eventId: options.eventId,
  });
  if (!resolved.ok) return resolved;

  const { rules, event, eventId, source } = resolved;
  const groupCount = Number(rules.groupStage.groupCount) || 4;
  const directQualifiersPerGroup =
    Number(rules.qualification.directQualifiersPerGroup) || 2;
  const totalQualifiers =
    Number(rules.qualification.totalQualifiers) ||
    groupCount * directQualifiersPerGroup;

  const defaultTarget =
    Number(rules.matchScoring.targetPoints) ||
    Number(rules.roundTargets?.[OFFICIAL_ROUND_SCORE_KEY.GROUP]) ||
    CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT;

  // G1-B: Adapter A competitionUnit only exposes maxParticipants.
  // FIXED_PAIR Content capacity.maxPairs is still projected into maxParticipants
  // for profile contract compatibility (lossy). Truthful units are in metadata.officialCapacity.
  const unit = {
    ...mapCompetitionUnit(event, rules.registrationMode),
    minParticipants: null,
    maxParticipants:
      rules.capacity?.maxParticipants != null
        ? Number(rules.capacity.maxParticipants)
        : rules.capacity?.maxPairs != null
          ? Number(rules.capacity.maxPairs)
          : null,
  };
  const scoringMethodRequested = mapScoringMethod(rules.matchScoring.scoringMethod);
  const matchSeriesRequested = mapMatchSeries(
    rules.matchScoring.matchSeries || rules.matchScoring.matchFormat
  );
  const win = rules.matchScoring.winCondition || {};
  const changeEnd = rules.matchScoring.changeEnd || {};

  const persistedSource =
    source === CONTENT_RULES_SOURCE.CONTENT_EXPLICIT
      ? "events[].competitionRules"
      : source === CONTENT_RULES_SOURCE.LEGACY_COMPATIBILITY_DRAFT
        ? "settings.officialCompetition (legacy compatibility draft)"
        : "canonical.system.default";

  const refByStage = rules.refereeRequirement?.byStage || {};

  const rawProfile = {
    schemaVersion: COMPETITION_RULES_PROFILE_SCHEMA_V1,
    tenantId,
    competitionId,
    profileId: `official-open:${competitionId}:${eventId}`,
    competitionUnit: unit,
    matchScoring: {
      scoringMethod: scoringMethodRequested,
      matchSeries: matchSeriesRequested,
      targetPoints: defaultTarget,
      winCondition: {
        winByEnabled: win.winByEnabled !== false,
        winByMargin:
          win.winByMargin != null && Number(win.winByMargin) >= 1
            ? Math.floor(Number(win.winByMargin))
            : 2,
        pointCapEnabled: Boolean(win.pointCapEnabled),
        pointCap:
          win.pointCap != null && Number(win.pointCap) >= 1
            ? Math.floor(Number(win.pointCap))
            : null,
      },
      changeEnd: {
        changeEndsEnabled: Boolean(changeEnd.changeEndsEnabled),
        changeEndsAtPoints:
          changeEnd.changeEndsAtPoints != null &&
          Number(changeEnd.changeEndsAtPoints) >= 1
            ? Math.floor(Number(changeEnd.changeEndsAtPoints))
            : scoringMethodRequested === SCORING_METHOD.RALLY
              ? 11
              : null,
        changeEndsBetweenGames: changeEnd.changeEndsBetweenGames !== false,
        decidingGameChangeEndsAt:
          changeEnd.decidingGameChangeEndsAt != null &&
          Number(changeEnd.decidingGameChangeEndsAt) >= 1
            ? Math.floor(Number(changeEnd.decidingGameChangeEndsAt))
            : null,
      },
    },
    stageOverrides: buildStageOverridesFromContent(rules),
    groupStage: {
      groupStageEnabled: rules.groupStage.groupStageEnabled !== false,
      groupCount,
      groupSizingPolicy: rules.groupStage.groupSizingPolicy || "FIXED_GROUP_COUNT",
      roundRobinPolicy: rules.groupStage.roundRobinPolicy || "SINGLE",
      allowUnevenGroups: rules.groupStage.allowUnevenGroups !== false,
    },
    qualification: {
      totalQualifiers,
      directQualifiersPerGroup,
    },
    inGroupTieBreak: rules.inGroupTieBreak || undefined,
    crossGroupRanking: rules.crossGroupRanking || undefined,
    knockout: {
      knockoutEnabled: rules.knockout.knockoutEnabled !== false,
      qualifierCount: totalQualifiers,
      entryRound: rules.knockout.entryRound || undefined,
      pairingPolicy: rules.knockout.pairingPolicy || "CROSS_GROUP",
      avoidSameGroupFirstRound: rules.knockout.avoidSameGroupFirstRound !== false,
    },
    walkover: rules.walkover || undefined,
    checkIn: rules.checkIn || undefined,
    scheduleConstraints: {
      estimatedMatchDurationMinutes:
        rules.scheduleConstraints?.estimatedMatchDurationMinutes ?? 45,
      minimumRestMinutes: rules.scheduleConstraints?.minimumRestMinutes ?? 15,
      stageScheduleWindows: {},
    },
    courtRequirement: {
      venueId: null,
      facilityClusterId: null,
      physicalCourtIds: [],
      stageCourtRequirements: rules.courtRequirement?.stageCourtRequirements || {},
    },
    refereeRequirement: {
      byStage: {
        [COMPETITION_RULES_STAGE.GROUP]:
          refByStage.GROUP || REFEREE_REQUIREMENT.OPTIONAL,
        [COMPETITION_RULES_STAGE.ROUND_OF_16]:
          refByStage.ROUND_OF_16 || REFEREE_REQUIREMENT.OPTIONAL,
        [COMPETITION_RULES_STAGE.QUARTERFINAL]:
          refByStage.QUARTERFINAL || REFEREE_REQUIREMENT.REQUIRED,
        [COMPETITION_RULES_STAGE.SEMIFINAL]:
          refByStage.SEMIFINAL || REFEREE_REQUIREMENT.REQUIRED,
        [COMPETITION_RULES_STAGE.FINAL]:
          refByStage.FINAL || REFEREE_REQUIREMENT.REQUIRED,
      },
      fallbackPolicy: rules.refereeRequirement?.fallbackPolicy || "BLOCK_START",
    },
    publication: rules.publication || undefined,
    metadata: {
      source: "official-open-adapter-b",
      persistedSource,
      derivedSource: source,
      eventId: String(eventId),
      contentId: String(eventId),
      inferredSoleEvent: resolved.inferredSoleEvent === true,
      ownsAuthority: false,
      translationOnly: true,
      tournamentRuleInheritance: false,
      lifecycleEvidence: options.lifecycleEvidence || null,
      pr459AdmissionDeferred: true,
      officialSeedingPolicy: rules.seedingPolicy || "NONE",
      officialSubstitution: rules.substitution || null,
      officialEligibility: rules.eligibility || null,
      // Non-authoritative Content capacity truth (registration runtime uses Content resolver).
      officialCapacity: {
        registrationMode: rules.registrationMode,
        capacityUnit:
          rules.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR
            ? "PAIR"
            : "PARTICIPANT",
        maxParticipants:
          rules.capacity?.maxParticipants != null
            ? Number(rules.capacity.maxParticipants)
            : null,
        maxPairs:
          rules.capacity?.maxPairs != null
            ? Number(rules.capacity.maxPairs)
            : null,
        profileMaxParticipantsLossy:
          rules.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR &&
          rules.capacity?.maxPairs != null &&
          rules.capacity?.maxParticipants == null,
      },
      wildcardSlotsDerived: Number(rules.qualification?.wildcardSlots) || 0,
    },
  };

  const profile = createCompetitionRulesProfile(rawProfile);
  return {
    ok: true,
    profile,
    event,
    eventId: String(eventId),
    contentId: String(eventId),
    contentRules: rules,
    contentRulesSource: source,
    persistedSource,
    derived: source !== CONTENT_RULES_SOURCE.CONTENT_EXPLICIT,
    ownsAuthority: false,
  };
}
