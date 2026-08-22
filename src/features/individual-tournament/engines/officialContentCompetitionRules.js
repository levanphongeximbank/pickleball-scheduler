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
import { isDrawEligibleEntry } from "../../../models/tournament/entry.js";
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

/**
 * Group 1 (Nội dung & đăng ký) field ownership — G1-A lock.
 * Event identity fields stay on the Event record; registration/eligibility/
 * capacity/seeding policy live on events[].competitionRules.
 */
export const CONTENT_GROUP1_FIELD_AUTHORITY = Object.freeze({
  eventName: "EVENT_IDENTITY",
  eventType: "EVENT_IDENTITY",
  gender: "DERIVED_FROM_EVENT_TYPE",
  registrationMode: "CONTENT_COMPETITION_RULES",
  capacity: "CONTENT_COMPETITION_RULES",
  eligibility: "CONTENT_COMPETITION_RULES",
  seedingPolicy: "CONTENT_COMPETITION_RULES_METADATA",
});

export const CONTENT_CAPACITY_UNIT = Object.freeze({
  PARTICIPANTS: "PARTICIPANTS",
  PAIRS: "PAIRS",
});

/**
 * Legacy field classification (G1-A). Do not delete; do not re-author as
 * Content authority on Save. Runtime gate switches deferred to G1-B/C/E.
 */
export const LEGACY_GROUP1_FIELD_CLASS = Object.freeze({
  officialCompetition: "LEGACY_COMPATIBILITY_DRAFT",
  eligibilityRules: "CONFLICTING_LEGACY_RUNTIME",
  // G1-B: not authority on explicit Content Official/Open path; may remain for legacy-only callers.
  maxEntries: "LEGACY_RUNTIME_COMPATIBILITY",
});

/** Runtime projection unit labels (not persisted schema). */
export const CONTENT_CAPACITY_RUNTIME_UNIT = Object.freeze({
  PARTICIPANT: "PARTICIPANT",
  PAIR: "PAIR",
});

/**
 * Seeding policy is Content-persisted metadata. It must NOT drive Open
 * individual pair formation, fixed-pair re-pairing, or Open/AI Balance
 * group-draw ranking. Bracket/KO placement wiring is a later wave.
 */
export const CONTENT_SEEDING_SCOPE = Object.freeze({
  OPEN_INDIVIDUAL_PAIR_FORMATION: false,
  OPEN_FIXED_PAIR_REPAIRING: false,
  OPEN_OR_AI_BALANCE_GROUP_DRAW_RANKING: false,
  BRACKET_OR_KO_PLACEMENT: "DEFERRED",
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

/**
 * Unit-safe Content capacity view. Does not collapse PAIRS → PARTICIPANTS.
 * Adapter B profile.competitionUnit.maxParticipants may still be lossy for PAIR
 * mode (Adapter A contract); truthful units live here + metadata.
 */
export function normalizeContentCapacity(capacity = {}, registrationMode) {
  const mode = normalizeRegistrationMode(registrationMode);
  const maxParticipants = toPositiveInt(capacity?.maxParticipants, null);
  const maxPairs = toPositiveInt(capacity?.maxPairs, null);
  const unit =
    mode === OFFICIAL_REGISTRATION_MODE.PAIR
      ? CONTENT_CAPACITY_UNIT.PAIRS
      : CONTENT_CAPACITY_UNIT.PARTICIPANTS;
  return Object.freeze({
    unit,
    maxParticipants,
    maxPairs,
    effectiveLimit:
      unit === CONTENT_CAPACITY_UNIT.PAIRS ? maxPairs : maxParticipants,
    adapterBLossyCollapseToMaxParticipants: true,
  });
}

/**
 * Count registration units already consuming Content capacity for one Event.
 * INDIVIDUAL: one draw-eligible entry = one participant.
 * FIXED_PAIR (pair): one draw-eligible entry = one registered pair.
 * Does not invent a second pair registry.
 */
export function countContentCapacityUsed(event, registrationMode) {
  const mode = normalizeRegistrationMode(registrationMode);
  const eligible = (event?.entries || []).filter(isDrawEligibleEntry);
  if (mode === OFFICIAL_REGISTRATION_MODE.PAIR) {
    // PAIR_CAPACITY_COUNTING_UNIT=PAIR — canonical entry is the pair container.
    return eligible.length;
  }
  return eligible.length;
}

/**
 * Runtime projection for Official registration capacity enforcement.
 * Not persisted authority. Requires eventId for multi-Content tournaments.
 */
export function resolveContentRegistrationCapacityRuntime(tournament, options = {}) {
  const events = listTournamentEvents(tournament);
  const wanted = trim(options.eventId);
  if (!wanted && events.length > 1) {
    return {
      ok: false,
      code: "EVENT_REQUIRED",
      error: "Chọn nội dung tường minh (eventId) trước khi kiểm tra sức chứa.",
    };
  }

  const group1 = resolveContentGroup1Settings(tournament, {
    eventId: wanted || undefined,
    allowSoleEventInference:
      options.allowSoleEventInference != null
        ? options.allowSoleEventInference
        : events.length === 1,
  });
  if (!group1.ok) return group1;

  const capacity = group1.capacity;
  const capacityUnit =
    capacity.unit === CONTENT_CAPACITY_UNIT.PAIRS
      ? CONTENT_CAPACITY_RUNTIME_UNIT.PAIR
      : CONTENT_CAPACITY_RUNTIME_UNIT.PARTICIPANT;

  return {
    ok: true,
    eventId: group1.eventId,
    registrationMode: group1.registrationMode,
    capacityUnit,
    // Runtime projection only — do not persist as tournament.settings.registration.maxEntries.
    maxEntries: capacity.effectiveLimit,
    maxParticipants: capacity.maxParticipants,
    maxPairs: capacity.maxPairs,
    source: group1.source,
    authority: CONTENT_GROUP1_FIELD_AUTHORITY.capacity,
    legacyMaxEntriesClass: LEGACY_GROUP1_FIELD_CLASS.maxEntries,
  };
}

/**
 * Evaluate whether an Event is at Content capacity.
 * CONTENT_EXPLICIT: Content capacity only (null = unlimited; never tournament maxEntries).
 * Other sources: caller may apply LEGACY_RUNTIME_COMPATIBILITY maxEntries.
 */
export function evaluateContentRegistrationCapacity(tournament, event, options = {}) {
  const eventId = trim(options.eventId || event?.id);
  const resolved = resolveContentRegistrationCapacityRuntime(tournament, {
    ...options,
    eventId,
  });
  if (!resolved.ok) return resolved;

  const used = countContentCapacityUsed(event, resolved.registrationMode);
  const maxEntries = resolved.maxEntries;
  const atCapacity = maxEntries != null && used >= maxEntries;
  return {
    ...resolved,
    used,
    remaining: maxEntries == null ? null : Math.max(0, maxEntries - used),
    atCapacity,
    countingUnit:
      resolved.capacityUnit === CONTENT_CAPACITY_RUNTIME_UNIT.PAIR
        ? "PAIR"
        : "PARTICIPANT",
  };
}

/**
 * Seeding is not an Open pair-formation authority. Returns false always for
 * Open/AI Balance pair formation and registered-pair re-pairing callers.
 */
export function isContentSeedingAllowedForPairFormation() {
  return CONTENT_SEEDING_SCOPE.OPEN_INDIVIDUAL_PAIR_FORMATION === true;
}

export function assertContentSeedingNotPairFormationAuthority(consumer = "") {
  if (isContentSeedingAllowedForPairFormation()) return;
  const label = trim(consumer) || "caller";
  // Soft guard for future callers — does not throw (would change runtime if thrown today).
  return {
    ok: false,
    code: "SEEDING_NOT_PAIR_FORMATION_AUTHORITY",
    error: `seedingPolicy must not drive pair formation (${label}). Open individual = RANDOM; fixed pair = registered pair.`,
    scope: CONTENT_SEEDING_SCOPE,
  };
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
 *
 * eligibility here may be seeded from settings.eligibilityRules
 * (CONFLICTING_LEGACY_RUNTIME) for draft display only — Content Save must
 * persist to events[].competitionRules.eligibility, not dual-write back.
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

function resolveExplicitEvent(tournament, eventId, options = {}) {
  const events = listTournamentEvents(tournament);
  const wanted = trim(eventId);
  const allowSoleEventInference = options.allowSoleEventInference !== false;
  if (!wanted) {
    if (allowSoleEventInference && events.length === 1) {
      return {
        ok: true,
        event: events[0],
        eventId: String(events[0].id),
        inferredSoleEvent: true,
      };
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

/** Mutations must never infer sole event / events[0]. */
function resolveExplicitEventForMutation(tournament, eventId) {
  return resolveExplicitEvent(tournament, eventId, {
    allowSoleEventInference: false,
  });
}

/**
 * Resolve effective Content rules input for Adapter B / consumers.
 * Explicit Content rules win. Else legacy draft. Else canonical defaults.
 * Never auto-persists.
 * READ path may infer sole-event when eventId omitted (compatibility).
 */
export function resolveContentCompetitionRules(tournament, options = {}) {
  const scoped = resolveExplicitEvent(tournament, options.eventId, {
    allowSoleEventInference: options.allowSoleEventInference !== false,
  });
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
      legacyClass: LEGACY_GROUP1_FIELD_CLASS.officialCompetition,
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
 * Group 1 Content resolver surface (registration / capacity / eligibility / seeding).
 * Does NOT gate registration. Does NOT read tournament.settings.eligibilityRules
 * or maxEntries as Content authority.
 */
export function resolveContentGroup1Settings(tournament, options = {}) {
  const resolved = resolveContentCompetitionRules(tournament, {
    eventId: options.eventId,
    allowSoleEventInference: options.allowSoleEventInference,
  });
  if (!resolved.ok) return resolved;

  const { rules, source, eventId, event, inferredSoleEvent } = resolved;
  const capacity = normalizeContentCapacity(rules.capacity, rules.registrationMode);
  return {
    ok: true,
    eventId,
    event,
    inferredSoleEvent: inferredSoleEvent === true,
    source,
    authority: CONTENT_GROUP1_FIELD_AUTHORITY,
    registrationMode: rules.registrationMode,
    capacity,
    eligibility: rules.eligibility,
    seedingPolicy: rules.seedingPolicy,
    seedingScope: CONTENT_SEEDING_SCOPE,
    legacyClassification: LEGACY_GROUP1_FIELD_CLASS,
    // Observability for future G1-B/C — not a runtime gate.
    conflictingLegacyRuntime: Object.freeze({
      eligibilityRules: LEGACY_GROUP1_FIELD_CLASS.eligibilityRules,
      maxEntries: LEGACY_GROUP1_FIELD_CLASS.maxEntries,
    }),
  };
}

/** Content eligibility bounds only. Does not switch registrationEngine. */
export function resolveContentEligibilityBounds(tournament, options = {}) {
  const group1 = resolveContentGroup1Settings(tournament, options);
  if (!group1.ok) return group1;
  return {
    ok: true,
    eventId: group1.eventId,
    source: group1.source,
    authority: CONTENT_GROUP1_FIELD_AUTHORITY.eligibility,
    eligibility: group1.eligibility,
    ratingValueAuthority: "CANONICAL_RATING_ADAPTER",
    legacyRuntimeCompatibility: LEGACY_GROUP1_FIELD_CLASS.eligibilityRules,
  };
}

/**
 * Persist Content rules onto ONE event. Does not touch other events.
 * Does not write tournament.settings.officialCompetition competition-rule fields.
 * Does not dual-write tournament.settings.eligibilityRules or registration maxEntries.
 *
 * Prefer draft.contentRules (full object) when provided by Settings UI.
 * Outer Group 1 overlays (registrationMode/capacity/eligibility/seedingPolicy)
 * still apply so Save round-trips even when both contentRules + overlays are passed.
 *
 * MUTATION requires explicit eventId (no sole-event inference / no events[0]).
 */
export function patchEventContentCompetitionRules(tournament, eventId, patch = {}) {
  const scoped = resolveExplicitEventForMutation(tournament, eventId);
  if (!scoped.ok) {
    const err = new Error(scoped.error || "EVENT_REQUIRED");
    err.code = scoped.code || "EVENT_REQUIRED";
    throw err;
  }

  const current = hasExplicitContentCompetitionRules(scoped.event)
    ? normalizeContentCompetitionRules(
        scoped.event[CONTENT_COMPETITION_RULES_PROPERTY]
      )
    : resolveContentCompetitionRules(tournament, {
        eventId: scoped.eventId,
        allowSoleEventInference: false,
      }).rules;

  const contentBlob =
    patch.contentRules && typeof patch.contentRules === "object"
      ? patch.contentRules
      : null;
  const draftSource = contentBlob || patch;

  const mergedCapacity = {
    ...current.capacity,
    ...(draftSource.capacity || {}),
    ...(patch.capacity || {}),
  };
  // Preserve unit fields; do not invent maxEntries or collapse pairs→participants.
  if (Object.prototype.hasOwnProperty.call(patch, "maxParticipants")) {
    mergedCapacity.maxParticipants = patch.maxParticipants;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "maxPairs")) {
    mergedCapacity.maxPairs = patch.maxPairs;
  }

  const mergedInput = {
    ...current,
    ...draftSource,
    registrationMode:
      patch.registrationMode ??
      draftSource.registrationMode ??
      current.registrationMode,
    capacity: mergedCapacity,
    seedingPolicy:
      patch.seedingPolicy ?? draftSource.seedingPolicy ?? current.seedingPolicy,
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
      ...(patch.eligibility || {}),
      minLevel:
        patch.minLevel ??
        patch.eligibility?.minLevel ??
        draftSource.minLevel ??
        draftSource.eligibility?.minLevel ??
        current.eligibility.minLevel,
      maxLevel:
        patch.maxLevel ??
        patch.eligibility?.maxLevel ??
        draftSource.maxLevel ??
        draftSource.eligibility?.maxLevel ??
        current.eligibility.maxLevel,
      minRating:
        patch.minRating ??
        patch.eligibility?.minRating ??
        draftSource.minRating ??
        draftSource.eligibility?.minRating ??
        current.eligibility.minRating,
      maxRating:
        patch.maxRating ??
        patch.eligibility?.maxRating ??
        draftSource.maxRating ??
        draftSource.eligibility?.maxRating ??
        current.eligibility.maxRating,
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
      // Intentionally omit settings.eligibilityRules / registration maxEntries /
      // officialCompetition re-authoring — Content Save is event.competitionRules only.
    },
    eventId: scoped.eventId,
    rules: nextRules,
    source: CONTENT_RULES_SOURCE.CONTENT_EXPLICIT,
    group1: {
      registrationMode: nextRules.registrationMode,
      capacity: normalizeContentCapacity(
        nextRules.capacity,
        nextRules.registrationMode
      ),
      eligibility: nextRules.eligibility,
      seedingPolicy: nextRules.seedingPolicy,
    },
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

/**
 * Registration mode for Content. Prefer explicit eventId.
 * Return value shape unchanged (string) so pairing/runtime callers stay stable.
 * Use resolveContentRegistrationModeDetailed for source observability (G1-A).
 *
 * Resolution sources (detailed):
 *   CONTENT_EXPLICIT | LEGACY_COMPATIBILITY_DRAFT | CANONICAL_SYSTEM_DEFAULT
 */
export function resolveContentRegistrationMode(tournament, options = {}) {
  const detailed = resolveContentRegistrationModeDetailed(tournament, options);
  return detailed.registrationMode;
}

export function resolveContentRegistrationModeDetailed(tournament, options = {}) {
  const resolved = resolveContentCompetitionRules(tournament, {
    eventId: options.eventId,
    allowSoleEventInference: options.allowSoleEventInference,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      code: resolved.code,
      error: resolved.error,
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      source: CONTENT_RULES_SOURCE.CANONICAL_SYSTEM_DEFAULT,
      resolutionClass: "DEFAULT",
      authority: CONTENT_GROUP1_FIELD_AUTHORITY.registrationMode,
    };
  }
  const resolutionClass =
    resolved.source === CONTENT_RULES_SOURCE.CONTENT_EXPLICIT
      ? "CONTENT"
      : resolved.source === CONTENT_RULES_SOURCE.LEGACY_COMPATIBILITY_DRAFT
        ? "LEGACY_COMPATIBILITY"
        : "DEFAULT";
  return {
    ok: true,
    eventId: resolved.eventId,
    inferredSoleEvent: resolved.inferredSoleEvent === true,
    registrationMode: resolved.rules.registrationMode,
    source: resolved.source,
    resolutionClass,
    authority: CONTENT_GROUP1_FIELD_AUTHORITY.registrationMode,
  };
}
