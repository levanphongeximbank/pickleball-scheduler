/**
 * Official Content-level competition rules — persisted on Event.
 *
 * Authority lock:
 *   STAGE_OVERRIDE > CONTENT_RULE > CANONICAL_SYSTEM_DEFAULT
 *   NO tournament-level competition rules authority.
 *   NO tournament → content inheritance.
 *
 * Property: event.competitionRules
 * Schema: official.content.competitionRules.v1
 *
 * Adapter B translates this blob → competition.rules.profile.v1.
 * Does not persist Adapter A profile as a second SSOT.
 */

import {
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_ROUND_SCORE_KEY,
  OFFICIAL_SCORING_METHOD,
  DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP,
  CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
  getOfficialCompetitionSettings,
  normalizeOfficialRoundTargets,
  SIDEOUT_OPERATIONAL,
  BEST_OF_3_OPERATIONAL,
} from "./officialTournamentSettingsEngine.js";
import { getEligibilityRules } from "./eligibilityEngine.js";
import { listTournamentEvents, resolveSelectedEvent } from "../../tournament/experience-a1/deriveOverview.js";

export const CONTENT_COMPETITION_RULES_PROPERTY = "competitionRules";

export const CONTENT_COMPETITION_RULES_SCHEMA_V1 =
  "official.content.competitionRules.v1";

export const CONTENT_RULES_SOURCE = Object.freeze({
  CONTENT_EXPLICIT: "CONTENT_EXPLICIT",
  LEGACY_COMPATIBILITY_DRAFT: "LEGACY_COMPATIBILITY_DRAFT",
  CANONICAL_SYSTEM_DEFAULT: "CANONICAL_SYSTEM_DEFAULT",
});

function trim(value) {
  return value != null ? String(value).trim() : "";
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function boolOr(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeScoringMethod(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === OFFICIAL_SCORING_METHOD.SIDE_OUT || raw === "side-out" || raw === "side_out") {
    return SIDEOUT_OPERATIONAL
      ? OFFICIAL_SCORING_METHOD.SIDE_OUT
      : OFFICIAL_SCORING_METHOD.RALLY;
  }
  return OFFICIAL_SCORING_METHOD.RALLY;
}

function normalizeMatchFormat(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_");
  if (raw === OFFICIAL_MATCH_FORMAT.BEST_OF_3) {
    return BEST_OF_3_OPERATIONAL
      ? OFFICIAL_MATCH_FORMAT.BEST_OF_3
      : OFFICIAL_MATCH_FORMAT.BEST_OF_1;
  }
  return OFFICIAL_MATCH_FORMAT.BEST_OF_1;
}

function normalizeRegistrationMode(value, fallback = OFFICIAL_REGISTRATION_MODE.INDIVIDUAL) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === OFFICIAL_REGISTRATION_MODE.PAIR) return OFFICIAL_REGISTRATION_MODE.PAIR;
  if (raw === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL) {
    return OFFICIAL_REGISTRATION_MODE.INDIVIDUAL;
  }
  return fallback;
}

function normalizeStageOverrides(input = {}, baseTarget) {
  const source = input && typeof input === "object" ? input : {};
  // Accept either stage keys (GROUP/FINAL) or legacy roundTargets keys (group/final).
  const roundTargets = normalizeOfficialRoundTargets({
    [OFFICIAL_ROUND_SCORE_KEY.GROUP]:
      source.GROUP?.targetPoints ?? source.group ?? baseTarget,
    [OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16]:
      source.ROUND_OF_16?.targetPoints ?? source.round_of_16 ?? baseTarget,
    [OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL]:
      source.QUARTERFINAL?.targetPoints ?? source.quarterfinal ?? baseTarget,
    [OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL]:
      source.SEMIFINAL?.targetPoints ?? source.semifinal ?? baseTarget,
    [OFFICIAL_ROUND_SCORE_KEY.FINAL]:
      source.FINAL?.targetPoints ?? source.final ?? baseTarget,
  });
  return {
    roundTargets,
    byStage: Object.freeze({
      GROUP: { targetPoints: roundTargets[OFFICIAL_ROUND_SCORE_KEY.GROUP] },
      ROUND_OF_16: {
        targetPoints: roundTargets[OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16],
      },
      QUARTERFINAL: {
        targetPoints: roundTargets[OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL],
      },
      SEMIFINAL: {
        targetPoints: roundTargets[OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL],
      },
      FINAL: { targetPoints: roundTargets[OFFICIAL_ROUND_SCORE_KEY.FINAL] },
    }),
  };
}

/**
 * Normalize a Content rules blob. Missing optional fields use canonical defaults.
 */
export function normalizeContentCompetitionRules(input = {}, options = {}) {
  const baseTarget =
    toPositiveInt(input?.matchScoring?.targetPoints, null) ||
    toPositiveInt(input?.targetPoints, null) ||
    toPositiveInt(options.defaultTargetPoints, CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT);

  const scoringMethod = normalizeScoringMethod(
    input?.matchScoring?.scoringMethod ?? input?.scoringMethod
  );
  const matchFormat = normalizeMatchFormat(
    input?.matchScoring?.matchSeries ??
      input?.matchScoring?.matchFormat ??
      input?.matchFormat
  );
  const win = input?.matchScoring?.winCondition || input?.winCondition || {};
  const changeEnd = input?.matchScoring?.changeEnd || input?.changeEnd || {};
  const groupStage = input?.groupStage || {};
  const qualification = input?.qualification || {};
  const knockout = input?.knockout || {};
  const eligibility = input?.eligibility || {};
  const stage = normalizeStageOverrides(
    input?.stageOverrides || input?.roundTargets || {},
    baseTarget
  );

  const groupCount = toPositiveInt(groupStage.groupCount ?? input?.groupCount, 4);
  const directQualifiersPerGroup = toPositiveInt(
    qualification.directQualifiersPerGroup ?? input?.qualifiersPerGroup,
    DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP
  );
  const totalQualifiersExplicit = toPositiveInt(qualification.totalQualifiers, null);
  const totalQualifiers =
    totalQualifiersExplicit || groupCount * directQualifiersPerGroup;

  return Object.freeze({
    schemaVersion: CONTENT_COMPETITION_RULES_SCHEMA_V1,
    registrationMode: normalizeRegistrationMode(
      input?.registrationMode ?? input?.competitionUnit?.registrationMode,
      options.defaultRegistrationMode || OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
    ),
    matchScoring: Object.freeze({
      scoringMethod,
      matchFormat,
      matchSeries: matchFormat,
      targetPoints: baseTarget,
      winCondition: Object.freeze({
        winByEnabled: boolOr(win.winByEnabled, true),
        winByMargin: toPositiveInt(win.winByMargin, 2),
        pointCapEnabled: boolOr(win.pointCapEnabled, false),
        pointCap:
          boolOr(win.pointCapEnabled, false) && toPositiveInt(win.pointCap, null)
            ? toPositiveInt(win.pointCap, null)
            : null,
      }),
      changeEnd: Object.freeze({
        // CHANGE-END = đổi đầu sân / đổi bên — NOT physical court move.
        changeEndsEnabled: boolOr(changeEnd.changeEndsEnabled, false),
        changeEndsAtPoints: toPositiveInt(changeEnd.changeEndsAtPoints, null),
        changeEndsBetweenGames: boolOr(changeEnd.changeEndsBetweenGames, true),
        decidingGameChangeEndsAt: toPositiveInt(
          changeEnd.decidingGameChangeEndsAt,
          null
        ),
      }),
    }),
    stageOverrides: stage.byStage,
    roundTargets: stage.roundTargets,
    groupStage: Object.freeze({
      groupStageEnabled: boolOr(groupStage.groupStageEnabled, true),
      groupCount,
      groupSizingPolicy: groupStage.groupSizingPolicy || "FIXED_GROUP_COUNT",
      roundRobinPolicy: groupStage.roundRobinPolicy || "SINGLE",
      allowUnevenGroups: boolOr(groupStage.allowUnevenGroups, true),
    }),
    qualification: Object.freeze({
      directQualifiersPerGroup,
      totalQualifiers,
      // PR #459 admission modes remain deferred / not available on this branch.
      groupStageBypass: null,
      directKnockoutEntry: null,
      knockoutBye: null,
      wildcardSlots: toPositiveInt(qualification.wildcardSlots, 0) || 0,
    }),
    knockout: Object.freeze({
      knockoutEnabled: boolOr(knockout.knockoutEnabled, true),
      qualifierCount: totalQualifiers,
      pairingPolicy: knockout.pairingPolicy || "CROSS_GROUP",
      avoidSameGroupFirstRound: boolOr(knockout.avoidSameGroupFirstRound, true),
    }),
    eligibility: Object.freeze({
      maxLevel:
        eligibility.maxLevel != null && eligibility.maxLevel !== ""
          ? Number(eligibility.maxLevel)
          : null,
      maxRating:
        eligibility.maxRating != null && eligibility.maxRating !== ""
          ? Number(eligibility.maxRating)
          : null,
    }),
    refereeRequirement: Object.freeze({
      ...(input?.refereeRequirement && typeof input.refereeRequirement === "object"
        ? input.refereeRequirement
        : {}),
    }),
    courtRequirement: Object.freeze({
      ...(input?.courtRequirement && typeof input.courtRequirement === "object"
        ? input.courtRequirement
        : {}),
    }),
    scheduleConstraints: Object.freeze({
      ...(input?.scheduleConstraints && typeof input.scheduleConstraints === "object"
        ? input.scheduleConstraints
        : {}),
    }),
    updatedAt: input?.updatedAt || null,
  });
}

export function hasExplicitContentCompetitionRules(event) {
  const blob = event?.[CONTENT_COMPETITION_RULES_PROPERTY];
  return Boolean(blob && typeof blob === "object" && Object.keys(blob).length > 0);
}

export function deriveCanonicalDefaultContentRules(options = {}) {
  return normalizeContentCompetitionRules(
    {
      registrationMode:
        options.registrationMode || OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      matchScoring: {
        scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
        matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
        targetPoints: CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
        winCondition: {
          winByEnabled: true,
          winByMargin: 2,
          pointCapEnabled: false,
          pointCap: null,
        },
        changeEnd: {
          changeEndsEnabled: false,
          changeEndsAtPoints: null,
          changeEndsBetweenGames: true,
          decidingGameChangeEndsAt: null,
        },
      },
      groupStage: {
        groupStageEnabled: true,
        groupCount: 4,
      },
      qualification: {
        directQualifiersPerGroup: DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP,
      },
      knockout: {
        knockoutEnabled: true,
        pairingPolicy: "CROSS_GROUP",
        avoidSameGroupFirstRound: true,
      },
    },
    options
  );
}

/**
 * Legacy tournament.settings.officialCompetition → draft for ONE event.
 * Compatibility read only. Not ongoing inheritance. Not auto-persisted.
 */
export function deriveLegacyCompatibilityContentRulesDraft(tournament, options = {}) {
  const competition = getOfficialCompetitionSettings(tournament);
  const eligibility = getEligibilityRules(tournament);
  const blob = tournament?.settings?.officialCompetition || {};

  return normalizeContentCompetitionRules(
    {
      registrationMode: competition.registrationMode,
      matchScoring: {
        scoringMethod:
          competition.scoringMethodRequested || competition.scoringMethod,
        matchFormat: competition.matchFormatRequested || competition.matchFormat,
        targetPoints:
          competition.roundTargets?.[OFFICIAL_ROUND_SCORE_KEY.GROUP] ||
          CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT,
        winCondition: {
          winByEnabled: competition.winByEnabled !== false,
          winByMargin: competition.winByMargin || 2,
          pointCapEnabled: competition.pointCapEnabled === true,
          pointCap: competition.pointCap,
        },
        changeEnd: {
          changeEndsEnabled: competition.changeEndsEnabled === true,
          changeEndsAtPoints: competition.changeEndsAtPoints,
          changeEndsBetweenGames: true,
          decidingGameChangeEndsAt: null,
        },
      },
      roundTargets: competition.roundTargets,
      groupStage: {
        groupStageEnabled: true,
        groupCount: competition.groupCount,
      },
      qualification: {
        directQualifiersPerGroup: competition.qualifiersPerGroup,
        totalQualifiers: blob.totalQualifiers,
        wildcardSlots: blob.wildcardSlots,
      },
      knockout: {
        knockoutEnabled: true,
        pairingPolicy: "CROSS_GROUP",
        avoidSameGroupFirstRound: true,
      },
      eligibility: {
        maxLevel: eligibility?.skill?.maxLevel ?? null,
        maxRating: eligibility?.rating?.maxRating ?? null,
      },
    },
    options
  );
}

function resolveExplicitEvent(tournament, eventId) {
  const events = listTournamentEvents(tournament);
  const wanted = trim(eventId);
  if (!wanted) {
    if (events.length === 1) {
      return { ok: true, event: events[0], eventId: String(events[0].id), inferredSoleEvent: true };
    }
    return {
      ok: false,
      code: "EVENT_REQUIRED",
      error: "Chọn nội dung tường minh (eventId) — không dùng events[0].",
    };
  }
  const event = resolveSelectedEvent(events, wanted);
  if (!event || String(event.id) !== wanted) {
    return {
      ok: false,
      code: "EVENT_NOT_FOUND",
      error: "Không tìm thấy nội dung (eventId).",
    };
  }
  return { ok: true, event, eventId: wanted, inferredSoleEvent: false };
}

/**
 * Resolve effective Content rules input for Adapter B / consumers.
 * Explicit Content rules win. Else legacy draft. Else canonical defaults.
 * Never auto-persists.
 */
export function resolveContentCompetitionRules(tournament, options = {}) {
  const scoped = resolveExplicitEvent(tournament, options.eventId);
  if (!scoped.ok) return scoped;

  if (hasExplicitContentCompetitionRules(scoped.event)) {
    const rules = normalizeContentCompetitionRules(
      scoped.event[CONTENT_COMPETITION_RULES_PROPERTY]
    );
    return {
      ok: true,
      event: scoped.event,
      eventId: scoped.eventId,
      inferredSoleEvent: scoped.inferredSoleEvent === true,
      rules,
      source: CONTENT_RULES_SOURCE.CONTENT_EXPLICIT,
      persistedSource: `events[].${CONTENT_COMPETITION_RULES_PROPERTY}`,
      legacyActiveAuthority: false,
    };
  }

  const legacyBlob = tournament?.settings?.officialCompetition;
  if (legacyBlob && typeof legacyBlob === "object" && Object.keys(legacyBlob).length > 0) {
    const rules = deriveLegacyCompatibilityContentRulesDraft(tournament);
    return {
      ok: true,
      event: scoped.event,
      eventId: scoped.eventId,
      inferredSoleEvent: scoped.inferredSoleEvent === true,
      rules,
      source: CONTENT_RULES_SOURCE.LEGACY_COMPATIBILITY_DRAFT,
      persistedSource: "settings.officialCompetition (legacy compatibility only)",
      legacyActiveAuthority: false,
      note: "Legacy tournament blob used as draft only until Content Save materializes event.competitionRules.",
    };
  }

  const rules = deriveCanonicalDefaultContentRules();
  return {
    ok: true,
    event: scoped.event,
    eventId: scoped.eventId,
    inferredSoleEvent: scoped.inferredSoleEvent === true,
    rules,
    source: CONTENT_RULES_SOURCE.CANONICAL_SYSTEM_DEFAULT,
    persistedSource: null,
    legacyActiveAuthority: false,
  };
}

/**
 * Persist Content rules onto ONE event. Does not touch other events.
 * Does not write tournament.settings.officialCompetition competition-rule fields.
 */
export function patchEventContentCompetitionRules(tournament, eventId, patch = {}) {
  const scoped = resolveExplicitEvent(tournament, eventId);
  if (!scoped.ok) {
    const err = new Error(scoped.error || "EVENT_REQUIRED");
    err.code = scoped.code || "EVENT_REQUIRED";
    throw err;
  }

  const current = hasExplicitContentCompetitionRules(scoped.event)
    ? normalizeContentCompetitionRules(
        scoped.event[CONTENT_COMPETITION_RULES_PROPERTY]
      )
    : resolveContentCompetitionRules(tournament, { eventId: scoped.eventId }).rules;

  const mergedInput = {
    ...current,
    ...patch,
    registrationMode: patch.registrationMode ?? current.registrationMode,
    matchScoring: {
      ...current.matchScoring,
      ...(patch.matchScoring || {}),
      scoringMethod:
        patch.scoringMethod ??
        patch.matchScoring?.scoringMethod ??
        current.matchScoring.scoringMethod,
      matchFormat:
        patch.matchFormat ??
        patch.matchScoring?.matchFormat ??
        current.matchScoring.matchFormat,
      targetPoints:
        patch.targetPoints ??
        patch.matchScoring?.targetPoints ??
        current.matchScoring.targetPoints,
      winCondition: {
        ...current.matchScoring.winCondition,
        ...(patch.winCondition || {}),
        ...(patch.matchScoring?.winCondition || {}),
        winByEnabled:
          patch.winByEnabled ??
          patch.winCondition?.winByEnabled ??
          patch.matchScoring?.winCondition?.winByEnabled ??
          current.matchScoring.winCondition.winByEnabled,
        winByMargin:
          patch.winByMargin ??
          patch.winCondition?.winByMargin ??
          patch.matchScoring?.winCondition?.winByMargin ??
          current.matchScoring.winCondition.winByMargin,
        pointCapEnabled:
          patch.pointCapEnabled ??
          patch.winCondition?.pointCapEnabled ??
          patch.matchScoring?.winCondition?.pointCapEnabled ??
          current.matchScoring.winCondition.pointCapEnabled,
        pointCap:
          patch.pointCap ??
          patch.winCondition?.pointCap ??
          patch.matchScoring?.winCondition?.pointCap ??
          current.matchScoring.winCondition.pointCap,
      },
      changeEnd: {
        ...current.matchScoring.changeEnd,
        ...(patch.changeEnd || {}),
        ...(patch.matchScoring?.changeEnd || {}),
        changeEndsEnabled:
          patch.changeEndsEnabled ??
          patch.changeEnd?.changeEndsEnabled ??
          patch.matchScoring?.changeEnd?.changeEndsEnabled ??
          current.matchScoring.changeEnd.changeEndsEnabled,
        changeEndsAtPoints:
          patch.changeEndsAtPoints ??
          patch.changeEnd?.changeEndsAtPoints ??
          patch.matchScoring?.changeEnd?.changeEndsAtPoints ??
          current.matchScoring.changeEnd.changeEndsAtPoints,
      },
    },
    groupStage: {
      ...current.groupStage,
      ...(patch.groupStage || {}),
      groupCount:
        patch.groupCount ??
        patch.groupStage?.groupCount ??
        current.groupStage.groupCount,
      groupStageEnabled:
        patch.groupStageEnabled ??
        patch.groupStage?.groupStageEnabled ??
        current.groupStage.groupStageEnabled,
    },
    qualification: {
      ...current.qualification,
      ...(patch.qualification || {}),
      directQualifiersPerGroup:
        patch.qualifiersPerGroup ??
        patch.qualification?.directQualifiersPerGroup ??
        current.qualification.directQualifiersPerGroup,
      totalQualifiers:
        patch.totalQualifiers ??
        patch.qualification?.totalQualifiers ??
        current.qualification.totalQualifiers,
      wildcardSlots:
        patch.wildcardSlots ??
        patch.qualification?.wildcardSlots ??
        current.qualification.wildcardSlots,
    },
    knockout: {
      ...current.knockout,
      ...(patch.knockout || {}),
    },
    eligibility: {
      ...current.eligibility,
      ...(patch.eligibility || {}),
      maxLevel:
        patch.maxLevel ??
        patch.eligibility?.maxLevel ??
        current.eligibility.maxLevel,
      maxRating:
        patch.maxRating ??
        patch.eligibility?.maxRating ??
        current.eligibility.maxRating,
    },
    stageOverrides: patch.stageOverrides || patch.roundTargets || current.stageOverrides,
    roundTargets: patch.roundTargets || current.roundTargets,
    updatedAt: new Date().toISOString(),
  };

  const nextRules = normalizeContentCompetitionRules(mergedInput);
  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  const nextEvents = events.map((event) => {
    if (String(event.id) !== String(scoped.eventId)) return event;
    return {
      ...event,
      [CONTENT_COMPETITION_RULES_PROPERTY]: {
        schemaVersion: nextRules.schemaVersion,
        registrationMode: nextRules.registrationMode,
        matchScoring: nextRules.matchScoring,
        stageOverrides: nextRules.stageOverrides,
        roundTargets: nextRules.roundTargets,
        groupStage: nextRules.groupStage,
        qualification: nextRules.qualification,
        knockout: nextRules.knockout,
        eligibility: nextRules.eligibility,
        refereeRequirement: nextRules.refereeRequirement,
        courtRequirement: nextRules.courtRequirement,
        scheduleConstraints: nextRules.scheduleConstraints,
        updatedAt: nextRules.updatedAt,
      },
    };
  });

  return {
    tournament: {
      ...tournament,
      events: nextEvents,
    },
    eventId: scoped.eventId,
    rules: nextRules,
    source: CONTENT_RULES_SOURCE.CONTENT_EXPLICIT,
  };
}

export function resolveContentQualifiersPerGroup(tournament, options = {}) {
  if (options.qualifiersPerGroup != null) {
    return toPositiveInt(options.qualifiersPerGroup, DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP);
  }
  const resolved = resolveContentCompetitionRules(tournament, {
    eventId: options.eventId,
  });
  if (!resolved.ok) {
    return DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP;
  }
  return resolved.rules.qualification.directQualifiersPerGroup;
}

export function resolveContentGroupCount(tournament, options = {}) {
  if (options.groupCount != null) {
    return toPositiveInt(options.groupCount, 4);
  }
  const resolved = resolveContentCompetitionRules(tournament, {
    eventId: options.eventId,
  });
  if (!resolved.ok) return 4;
  return resolved.rules.groupStage.groupCount;
}

export function resolveContentRegistrationMode(tournament, options = {}) {
  const resolved = resolveContentCompetitionRules(tournament, {
    eventId: options.eventId,
  });
  if (!resolved.ok) return OFFICIAL_REGISTRATION_MODE.INDIVIDUAL;
  return resolved.rules.registrationMode;
}
