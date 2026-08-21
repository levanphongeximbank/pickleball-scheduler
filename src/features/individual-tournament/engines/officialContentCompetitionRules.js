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

function normalizeStageOverrides(input = {}, baseScoring) {
  const source = input && typeof input === "object" ? input : {};
  const baseTarget = Number(baseScoring?.targetPoints) || CANONICAL_OFFICIAL_POINTS_TO_WIN_DEFAULT;
  const stages = ["GROUP", "ROUND_OF_16", "QUARTERFINAL", "SEMIFINAL", "FINAL"];
  const roundKeyByStage = {
    GROUP: OFFICIAL_ROUND_SCORE_KEY.GROUP,
    ROUND_OF_16: OFFICIAL_ROUND_SCORE_KEY.ROUND_OF_16,
    QUARTERFINAL: OFFICIAL_ROUND_SCORE_KEY.QUARTERFINAL,
    SEMIFINAL: OFFICIAL_ROUND_SCORE_KEY.SEMIFINAL,
    FINAL: OFFICIAL_ROUND_SCORE_KEY.FINAL,
  };

  const byStage = {};
  const roundTargetsInput = {};

  for (const stage of stages) {
    const entry =
      source[stage] ||
      source[roundKeyByStage[stage]] ||
      (typeof source[roundKeyByStage[stage]] === "number"
        ? { targetPoints: source[roundKeyByStage[stage]] }
        : null);
    const inheritBase =
      !entry ||
      entry.inheritBase === true ||
      (entry.targetPoints == null &&
        entry.scoringMethod == null &&
        entry.matchSeries == null &&
        entry.matchFormat == null);
    if (inheritBase && (!entry || entry.inheritBase !== false)) {
      byStage[stage] = Object.freeze({
        inheritBase: true,
        targetPoints: baseTarget,
        scoringMethod: baseScoring.scoringMethod,
        matchSeries: baseScoring.matchSeries || baseScoring.matchFormat,
        winCondition: baseScoring.winCondition,
        changeEnd: baseScoring.changeEnd,
      });
      roundTargetsInput[roundKeyByStage[stage]] = baseTarget;
      continue;
    }
    const target =
      toPositiveInt(entry.targetPoints, null) ||
      toPositiveInt(entry, null) ||
      baseTarget;
    const scoringMethod = normalizeScoringMethod(
      entry.scoringMethod ?? baseScoring.scoringMethod
    );
    const matchFormat = normalizeMatchFormat(
      entry.matchSeries ?? entry.matchFormat ?? baseScoring.matchFormat
    );
    const win = entry.winCondition || {};
    const changeEnd = entry.changeEnd || {};
    byStage[stage] = Object.freeze({
      inheritBase: false,
      targetPoints: target,
      scoringMethod,
      matchSeries: matchFormat,
      matchFormat,
      winCondition: Object.freeze({
        winByEnabled: boolOr(win.winByEnabled, baseScoring.winCondition.winByEnabled),
        winByMargin: toPositiveInt(win.winByMargin, baseScoring.winCondition.winByMargin),
        pointCapEnabled: boolOr(
          win.pointCapEnabled,
          baseScoring.winCondition.pointCapEnabled
        ),
        pointCap:
          boolOr(win.pointCapEnabled, baseScoring.winCondition.pointCapEnabled) &&
          toPositiveInt(win.pointCap, null)
            ? toPositiveInt(win.pointCap, null)
            : baseScoring.winCondition.pointCap,
      }),
      changeEnd: Object.freeze({
        changeEndsEnabled: boolOr(
          changeEnd.changeEndsEnabled,
          baseScoring.changeEnd.changeEndsEnabled
        ),
        changeEndsAtPoints: toPositiveInt(
          changeEnd.changeEndsAtPoints,
          baseScoring.changeEnd.changeEndsAtPoints
        ),
        changeEndsBetweenGames: boolOr(
          changeEnd.changeEndsBetweenGames,
          baseScoring.changeEnd.changeEndsBetweenGames
        ),
        decidingGameChangeEndsAt: toPositiveInt(
          changeEnd.decidingGameChangeEndsAt,
          baseScoring.changeEnd.decidingGameChangeEndsAt
        ),
      }),
    });
    roundTargetsInput[roundKeyByStage[stage]] = target;
  }

  // Legacy flat roundTargets merge
  if (source.group != null || source.final != null) {
    const legacy = normalizeOfficialRoundTargets(source);
    Object.assign(roundTargetsInput, legacy);
    for (const stage of stages) {
      const key = roundKeyByStage[stage];
      if (legacy[key] != null) {
        byStage[stage] = Object.freeze({
          ...byStage[stage],
          inheritBase: false,
          targetPoints: legacy[key],
        });
      }
    }
  }

  const roundTargets = normalizeOfficialRoundTargets(roundTargetsInput);
  return { roundTargets, byStage: Object.freeze(byStage) };
}

function nonNegOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function decimalOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
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
  const matchScoring = Object.freeze({
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
      changeEndsEnabled: boolOr(changeEnd.changeEndsEnabled, false),
      changeEndsAtPoints: toPositiveInt(changeEnd.changeEndsAtPoints, null),
      changeEndsBetweenGames: boolOr(changeEnd.changeEndsBetweenGames, true),
      decidingGameChangeEndsAt: toPositiveInt(
        changeEnd.decidingGameChangeEndsAt,
        null
      ),
    }),
  });

  const groupStageIn = input?.groupStage || {};
  const qualification = input?.qualification || {};
  const knockout = input?.knockout || {};
  const eligibility = input?.eligibility || {};
  const stage = normalizeStageOverrides(
    input?.stageOverrides || input?.roundTargets || {},
    matchScoring
  );

  const groupCount = toPositiveInt(groupStageIn.groupCount ?? input?.groupCount, 4);
  const directQualifiersPerGroup = toPositiveInt(
    qualification.directQualifiersPerGroup ?? input?.qualifiersPerGroup,
    DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP
  );
  const totalQualifiersExplicit = toPositiveInt(qualification.totalQualifiers, null);
  const totalQualifiers =
    totalQualifiersExplicit || groupCount * directQualifiersPerGroup;
  const derivedWildcard = Math.max(0, totalQualifiers - groupCount * directQualifiersPerGroup);

  const inGroup = input?.inGroupTieBreak || {};
  const crossGroup = input?.crossGroupRanking || {};
  const walkover = input?.walkover || {};
  const checkIn = input?.checkIn || {};
  const schedule = input?.scheduleConstraints || {};
  const court = input?.courtRequirement || {};
  const referee = input?.refereeRequirement || {};
  const publication = input?.publication || {};
  const substitution = input?.substitution || {};

  return Object.freeze({
    schemaVersion: CONTENT_COMPETITION_RULES_SCHEMA_V1,
    registrationMode: normalizeRegistrationMode(
      input?.registrationMode ?? input?.competitionUnit?.registrationMode,
      options.defaultRegistrationMode || OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
    ),
    capacity: Object.freeze({
      maxParticipants: toPositiveInt(
        input?.capacity?.maxParticipants ?? input?.maxParticipants,
        null
      ),
      maxPairs: toPositiveInt(input?.capacity?.maxPairs ?? input?.maxPairs, null),
    }),
    seedingPolicy: (() => {
      const raw = String(input?.seedingPolicy || "NONE").trim().toUpperCase();
      if (["NONE", "MANUAL", "RANKING", "RATING"].includes(raw)) return raw;
      return "NONE";
    })(),
    matchScoring,
    stageOverrides: stage.byStage,
    roundTargets: stage.roundTargets,
    groupStage: Object.freeze({
      groupStageEnabled: boolOr(groupStageIn.groupStageEnabled, true),
      groupCount,
      maxUnitsPerGroup: toPositiveInt(groupStageIn.maxUnitsPerGroup, null),
      groupSizingPolicy: groupStageIn.groupSizingPolicy || "FIXED_GROUP_COUNT",
      roundRobinPolicy:
        String(groupStageIn.roundRobinPolicy || "SINGLE").toUpperCase() === "DOUBLE"
          ? "SINGLE" // DOUBLE not operational on Official classic path
          : "SINGLE",
      allowUnevenGroups: boolOr(groupStageIn.allowUnevenGroups, true),
    }),
    qualification: Object.freeze({
      directQualifiersPerGroup,
      totalQualifiers,
      wildcardSlots: derivedWildcard,
      groupStageBypass: null,
      directKnockoutEntry: null,
      knockoutBye: null,
    }),
    knockout: Object.freeze({
      knockoutEnabled: boolOr(knockout.knockoutEnabled, true),
      qualifierCount: totalQualifiers,
      entryRound: knockout.entryRound || null,
      pairingPolicy: ["CROSS_GROUP", "SEEDED", "RANDOM"].includes(
        String(knockout.pairingPolicy || "").toUpperCase()
      )
        ? String(knockout.pairingPolicy).toUpperCase()
        : "CROSS_GROUP",
      avoidSameGroupFirstRound: boolOr(knockout.avoidSameGroupFirstRound, true),
    }),
    eligibility: Object.freeze({
      minLevel: decimalOrNull(eligibility.minLevel),
      maxLevel: decimalOrNull(eligibility.maxLevel),
      minRating: decimalOrNull(eligibility.minRating),
      maxRating: decimalOrNull(eligibility.maxRating),
    }),
    inGroupTieBreak: Object.freeze({
      criteria: Array.isArray(inGroup.criteria) && inGroup.criteria.length
        ? inGroup.criteria.map((c) => String(c).trim().toUpperCase())
        : [
            "MATCH_WINS",
            "HEAD_TO_HEAD",
            "POINT_DIFFERENTIAL",
            "POINTS_SCORED",
            "DRAW_LOTS",
          ],
      multiWayRequiresMiniTable: boolOr(inGroup.multiWayRequiresMiniTable, true),
    }),
    crossGroupRanking: Object.freeze({
      criteria: Array.isArray(crossGroup.criteria) && crossGroup.criteria.length
        ? crossGroup.criteria.map((c) => String(c).trim().toUpperCase())
        : [
            "WIN_PERCENTAGE",
            "POINT_DIFFERENTIAL_PER_MATCH",
            "POINTS_SCORED_PER_MATCH",
            "DRAW_LOTS",
          ],
      normalizeByMatchesPlayed: boolOr(crossGroup.normalizeByMatchesPlayed, true),
    }),
    walkover: Object.freeze({
      walkoverPolicy: walkover.walkoverPolicy || "STANDARD_WALKOVER",
      lateArrivalPolicy: Object.freeze({
        enabled: boolOr(walkover.lateArrivalPolicy?.enabled, true),
        thresholdMinutes: toPositiveInt(
          walkover.lateArrivalPolicy?.thresholdMinutes,
          15
        ),
        directorOverrideAllowed: boolOr(
          walkover.lateArrivalPolicy?.directorOverrideAllowed,
          true
        ),
      }),
      retiredMatchPolicy: walkover.retiredMatchPolicy || "RETIRED_AS_LOSS",
      withdrawalPolicy:
        walkover.withdrawalPolicy || "KEEP_COMPLETED_AND_WO_REMAINING",
    }),
    checkIn: Object.freeze({
      checkInRequired: boolOr(checkIn.checkInRequired, false),
      checkInCloseMinutesBeforeStart: nonNegOrNull(
        checkIn.checkInCloseMinutesBeforeStart
      ) ?? 30,
      noCheckInPolicy: checkIn.noCheckInPolicy || "WARN",
      directorOverrideAllowed: boolOr(checkIn.directorOverrideAllowed, true),
    }),
    substitution: Object.freeze({
      allowed: boolOr(substitution.allowed, false),
      deadline: ["BEFORE_DRAW", "BEFORE_FIRST_MATCH", "EMERGENCY_ONLY"].includes(
        String(substitution.deadline || "").toUpperCase()
      )
        ? String(substitution.deadline).toUpperCase()
        : "BEFORE_DRAW",
      directorApprovalRequired: boolOr(substitution.directorApprovalRequired, true),
      runtimeSupport: "PARTIAL",
    }),
    scheduleConstraints: Object.freeze({
      estimatedMatchDurationMinutes: toPositiveInt(
        schedule.estimatedMatchDurationMinutes,
        45
      ),
      minimumRestMinutes: nonNegOrNull(schedule.minimumRestMinutes) ?? 15,
      noOverlapSameParticipant: boolOr(schedule.noOverlapSameParticipant, true),
      restConstraintEnforcement: schedule.restConstraintEnforcement || "WARN",
    }),
    courtRequirement: Object.freeze({
      minimumCourts: toPositiveInt(court.minimumCourts, null),
      stageCourtRequirements:
        court.stageCourtRequirements && typeof court.stageCourtRequirements === "object"
          ? Object.freeze({ ...court.stageCourtRequirements })
          : Object.freeze({}),
      note: "POLICY only — physical court assignment is Schedule/Court Adapter",
    }),
    refereeRequirement: Object.freeze({
      byStage: Object.freeze({
        GROUP: referee.byStage?.GROUP || "OPTIONAL",
        ROUND_OF_16: referee.byStage?.ROUND_OF_16 || "OPTIONAL",
        QUARTERFINAL: referee.byStage?.QUARTERFINAL || "REQUIRED",
        SEMIFINAL: referee.byStage?.SEMIFINAL || "REQUIRED",
        FINAL: referee.byStage?.FINAL || "REQUIRED",
      }),
      fallbackPolicy: referee.fallbackPolicy || "BLOCK_START",
    }),
    publication: Object.freeze({
      resultsPublicationPolicy:
        publication.resultsPublicationPolicy || "AFTER_ACCEPTED_RESULT",
      standingsPublicationPolicy:
        publication.standingsPublicationPolicy || "PUBLIC",
      bracketPublicationPolicy:
        publication.bracketPublicationPolicy || "DIRECTOR_APPROVAL",
      finalResultsPublicationPolicy:
        publication.finalResultsPublicationPolicy || "DIRECTOR_APPROVAL",
    }),
    updatedAt: input?.updatedAt || null,
  });
}

export function buildContentRulesSummaryLines(rules) {
  if (!rules?.matchScoring) return ["Chưa cấu hình thể thức"];
  const method =
    String(rules.matchScoring.scoringMethod || "").toLowerCase() === "side_out"
      ? "Side-out"
      : "Rally";
  const series =
    String(rules.matchScoring.matchSeries || rules.matchScoring.matchFormat || "")
      .toUpperCase()
      .includes("BEST_OF_3")
      ? "BO3"
      : "BO1";
  const stages = [
    ["Vòng bảng", "GROUP"],
    ["Vòng 16", "ROUND_OF_16"],
    ["Tứ kết", "QUARTERFINAL"],
    ["Bán kết", "SEMIFINAL"],
    ["Chung kết", "FINAL"],
  ];
  const lines = [`${method} · ${series}`];
  for (const [label, key] of stages) {
    const pts =
      rules.stageOverrides?.[key]?.targetPoints ??
      rules.matchScoring.targetPoints ??
      11;
    lines.push(`${label} ${pts}`);
  }
  return lines;
}

export function serializeContentCompetitionRulesForPersist(rules) {
  return {
    schemaVersion: rules.schemaVersion,
    registrationMode: rules.registrationMode,
    capacity: rules.capacity,
    seedingPolicy: rules.seedingPolicy,
    matchScoring: rules.matchScoring,
    stageOverrides: rules.stageOverrides,
    roundTargets: rules.roundTargets,
    groupStage: rules.groupStage,
    qualification: rules.qualification,
    knockout: rules.knockout,
    eligibility: rules.eligibility,
    inGroupTieBreak: rules.inGroupTieBreak,
    crossGroupRanking: rules.crossGroupRanking,
    walkover: rules.walkover,
    checkIn: rules.checkIn,
    substitution: rules.substitution,
    scheduleConstraints: rules.scheduleConstraints,
    courtRequirement: rules.courtRequirement,
    refereeRequirement: rules.refereeRequirement,
    publication: rules.publication,
    updatedAt: rules.updatedAt,
  };
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
 *
 * Prefer draft.contentRules (full object) when provided by Settings UI.
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

  const draftSource =
    patch.contentRules && typeof patch.contentRules === "object"
      ? patch.contentRules
      : patch;

  const mergedInput = {
    ...current,
    ...draftSource,
    registrationMode: draftSource.registrationMode ?? current.registrationMode,
    capacity: { ...current.capacity, ...(draftSource.capacity || {}) },
    seedingPolicy: draftSource.seedingPolicy ?? current.seedingPolicy,
    matchScoring: {
      ...current.matchScoring,
      ...(draftSource.matchScoring || {}),
      scoringMethod:
        draftSource.scoringMethod ??
        draftSource.matchScoring?.scoringMethod ??
        current.matchScoring.scoringMethod,
      matchFormat:
        draftSource.matchFormat ??
        draftSource.matchScoring?.matchFormat ??
        current.matchScoring.matchFormat,
      targetPoints:
        draftSource.targetPoints ??
        draftSource.matchScoring?.targetPoints ??
        current.matchScoring.targetPoints,
      winCondition: {
        ...current.matchScoring.winCondition,
        ...(draftSource.winCondition || {}),
        ...(draftSource.matchScoring?.winCondition || {}),
      },
      changeEnd: {
        ...current.matchScoring.changeEnd,
        ...(draftSource.changeEnd || {}),
        ...(draftSource.matchScoring?.changeEnd || {}),
      },
    },
    groupStage: {
      ...current.groupStage,
      ...(draftSource.groupStage || {}),
      groupCount:
        draftSource.groupCount ??
        draftSource.groupStage?.groupCount ??
        current.groupStage.groupCount,
    },
    qualification: {
      ...current.qualification,
      ...(draftSource.qualification || {}),
      directQualifiersPerGroup:
        draftSource.qualifiersPerGroup ??
        draftSource.qualification?.directQualifiersPerGroup ??
        current.qualification.directQualifiersPerGroup,
      totalQualifiers:
        draftSource.totalQualifiers ??
        draftSource.qualification?.totalQualifiers ??
        current.qualification.totalQualifiers,
    },
    knockout: { ...current.knockout, ...(draftSource.knockout || {}) },
    eligibility: {
      ...current.eligibility,
      ...(draftSource.eligibility || {}),
      minLevel: draftSource.minLevel ?? draftSource.eligibility?.minLevel ?? current.eligibility.minLevel,
      maxLevel: draftSource.maxLevel ?? draftSource.eligibility?.maxLevel ?? current.eligibility.maxLevel,
      minRating:
        draftSource.minRating ?? draftSource.eligibility?.minRating ?? current.eligibility.minRating,
      maxRating:
        draftSource.maxRating ?? draftSource.eligibility?.maxRating ?? current.eligibility.maxRating,
    },
    inGroupTieBreak: {
      ...current.inGroupTieBreak,
      ...(draftSource.inGroupTieBreak || {}),
    },
    crossGroupRanking: {
      ...current.crossGroupRanking,
      ...(draftSource.crossGroupRanking || {}),
    },
    walkover: { ...current.walkover, ...(draftSource.walkover || {}) },
    checkIn: { ...current.checkIn, ...(draftSource.checkIn || {}) },
    substitution: { ...current.substitution, ...(draftSource.substitution || {}) },
    scheduleConstraints: {
      ...current.scheduleConstraints,
      ...(draftSource.scheduleConstraints || {}),
    },
    courtRequirement: {
      ...current.courtRequirement,
      ...(draftSource.courtRequirement || {}),
    },
    refereeRequirement: {
      ...current.refereeRequirement,
      ...(draftSource.refereeRequirement || {}),
      byStage: {
        ...current.refereeRequirement?.byStage,
        ...(draftSource.refereeRequirement?.byStage || {}),
      },
    },
    publication: { ...current.publication, ...(draftSource.publication || {}) },
    stageOverrides: draftSource.stageOverrides || current.stageOverrides,
    roundTargets: draftSource.roundTargets || current.roundTargets,
    updatedAt: new Date().toISOString(),
  };

  const nextRules = normalizeContentCompetitionRules(mergedInput);
  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  const nextEvents = events.map((event) => {
    if (String(event.id) !== String(scoped.eventId)) return event;
    return {
      ...event,
      [CONTENT_COMPETITION_RULES_PROPERTY]: serializeContentCompetitionRulesForPersist({
        ...nextRules,
        updatedAt: nextRules.updatedAt,
      }),
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
