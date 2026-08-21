/**
 * Official/Open → competition.rules.profile.v1 translator.
 * Translation only. No persistence. No second rules SSOT.
 *
 * Persisted source remains tournament.settings.officialCompetition (+ event scope).
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
  getOfficialCompetitionSettings,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_ROUND_SCORE_KEY,
  DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP,
  CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
} from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";

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

function resolveExplicitEvent(tournament, eventId) {
  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  const wanted = trim(eventId);
  if (!wanted) {
    if (events.length === 0) {
      return {
        ok: false,
        code: "EVENT_REQUIRED",
        error: "Chọn nội dung trước khi dựng Competition Rules Profile.",
      };
    }
    if (events.length > 1) {
      return {
        ok: false,
        code: "EVENT_REQUIRED",
        error: "Nhiều nội dung — bắt buộc eventId tường minh (không dùng events[0]).",
      };
    }
    return { ok: true, event: events[0], inferredSoleEvent: true };
  }
  const event = events.find((row) => String(row.id) === wanted);
  if (!event) {
    return {
      ok: false,
      code: "EVENT_NOT_FOUND",
      error: "Không tìm thấy nội dung (eventId).",
    };
  }
  return { ok: true, event, inferredSoleEvent: false };
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

function mapCompetitionUnit(event) {
  const type = event?.eventType || EVENT_TYPE.MEN_DOUBLE;
  if (isSingleEventType(type)) {
    return {
      competitionUnitKind: COMPETITION_UNIT_KIND.SINGLES,
      registrationUnitKind: REGISTRATION_UNIT_KIND.PLAYER,
    };
  }
  if (isDoubleEventType(type)) {
    return {
      competitionUnitKind: COMPETITION_UNIT_KIND.DOUBLES,
      registrationUnitKind: REGISTRATION_UNIT_KIND.PAIR,
    };
  }
  return {
    competitionUnitKind: COMPETITION_UNIT_KIND.DOUBLES,
    registrationUnitKind: REGISTRATION_UNIT_KIND.PAIR,
  };
}

function buildStageOverrides(roundTargets = {}) {
  const overrides = {};
  for (const [roundKey, stage] of Object.entries(ROUND_KEY_TO_STAGE)) {
    const points = Number(roundTargets?.[roundKey]);
    if (Number.isFinite(points) && points >= 1) {
      overrides[stage] = { targetPoints: Math.floor(points) };
    }
  }
  return overrides;
}

/**
 * Build competition.rules.profile.v1 from Official persisted settings.
 *
 * @param {object} tournament
 * @param {{ eventId?: string, lifecycleEvidence?: object }} [options]
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

  const scoped = resolveExplicitEvent(tournament, options.eventId);
  if (!scoped.ok) return scoped;

  const settings = getOfficialCompetitionSettings(tournament);
  const blob = tournament?.settings?.officialCompetition || {};
  const groupCount = Number(settings.groupCount) || 4;
  const directQualifiersPerGroup =
    Number(settings.qualifiersPerGroup) || DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP;
  const totalQualifiersExplicit = Number(blob.totalQualifiers);
  const totalQualifiers =
    Number.isFinite(totalQualifiersExplicit) && totalQualifiersExplicit >= 1
      ? Math.floor(totalQualifiersExplicit)
      : groupCount * directQualifiersPerGroup;

  const defaultTarget =
    Number(settings.roundTargets?.[OFFICIAL_ROUND_SCORE_KEY.GROUP]) ||
    CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT;

  const unit = mapCompetitionUnit(scoped.event);
  const scoringMethodRequested = mapScoringMethod(
    settings.scoringMethodRequested || settings.scoringMethod
  );
  const matchSeriesRequested = mapMatchSeries(
    settings.matchFormatRequested || settings.matchFormat
  );

  const rawProfile = {
    schemaVersion: COMPETITION_RULES_PROFILE_SCHEMA_V1,
    tenantId,
    competitionId,
    profileId: `official-open:${competitionId}:${scoped.event.id}`,
    competitionUnit: unit,
    matchScoring: {
      // Profile preserves configured intent; effective selectable uses binding min().
      // Win-by / point-cap / change-end policy projected for CORE-16 format binding.
      scoringMethod: scoringMethodRequested,
      matchSeries: matchSeriesRequested,
      targetPoints: defaultTarget,
      winCondition: {
        winByEnabled: true,
        winByMargin: 2,
        pointCapEnabled: Boolean(blob.pointCapEnabled),
        pointCap:
          blob.pointCap != null && Number(blob.pointCap) >= 1
            ? Math.floor(Number(blob.pointCap))
            : null,
      },
      changeEnd: {
        // Policy may describe change-end; Official execution remains PARTIAL (session ACK).
        changeEndsEnabled: Boolean(blob.changeEndsEnabled),
        changeEndsAtPoints:
          blob.changeEndsAtPoints != null && Number(blob.changeEndsAtPoints) >= 1
            ? Math.floor(Number(blob.changeEndsAtPoints))
            : scoringMethodRequested === SCORING_METHOD.RALLY
              ? 11
              : null,
        changeEndsBetweenGames: true,
        decidingGameChangeEndsAt: null,
      },
    },
    stageOverrides: buildStageOverrides(settings.roundTargets),
    groupStage: {
      groupStageEnabled: true,
      groupCount,
      groupSizingPolicy: "FIXED_GROUP_COUNT",
      roundRobinPolicy: "SINGLE",
      allowUnevenGroups: true,
    },
    qualification: {
      totalQualifiers,
      directQualifiersPerGroup,
    },
    knockout: {
      knockoutEnabled: true,
      qualifierCount: totalQualifiers,
      pairingPolicy: "CROSS_GROUP",
      avoidSameGroupFirstRound: true,
    },
    refereeRequirement: {
      byStage: {
        [COMPETITION_RULES_STAGE.GROUP]: REFEREE_REQUIREMENT.OPTIONAL,
        [COMPETITION_RULES_STAGE.SEMIFINAL]: REFEREE_REQUIREMENT.REQUIRED,
        [COMPETITION_RULES_STAGE.FINAL]: REFEREE_REQUIREMENT.REQUIRED,
      },
    },
    metadata: {
      source: "official-open-adapter-b",
      persistedSource: "settings.officialCompetition",
      eventId: String(scoped.event.id),
      inferredSoleEvent: scoped.inferredSoleEvent === true,
      ownsAuthority: false,
      translationOnly: true,
      lifecycleEvidence: options.lifecycleEvidence || null,
    },
  };

  const profile = createCompetitionRulesProfile(rawProfile);
  return {
    ok: true,
    profile,
    event: scoped.event,
    eventId: String(scoped.event.id),
    persistedSource: "settings.officialCompetition",
    derived: true,
    ownsAuthority: false,
  };
}
