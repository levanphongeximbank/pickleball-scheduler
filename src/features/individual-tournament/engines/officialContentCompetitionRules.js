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
import { getEligibilityRules, normalizeEligibilityRules } from "./eligibilityEngine.js";
import { listTournamentEvents, resolveSelectedEvent } from "../../tournament/experience-a1/deriveOverview.js";
import { deriveQualificationPlan } from "../../competition-core/competition-rules/services/deriveQualificationPlan.js";

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
  // G1-E: draft projection only — never override explicit Content Group 1 fields.
  officialCompetition: "LEGACY_COMPATIBILITY_DRAFT",
  // G1-C/E: not skill/rating authority on explicit Content Official/Open path.
  // Non-skill/rating dimensions may remain as separate registration-domain checks.
  eligibilityRules: "LEGACY_RUNTIME_COMPATIBILITY",
  // G1-B/E: not capacity authority on explicit Content Official/Open path.
  maxEntries: "LEGACY_RUNTIME_COMPATIBILITY",
});

/**
 * Group 2 (Cấu trúc thi đấu) field ownership — G2-A lock.
 * Structure lives on events[].competitionRules.{groupStage,qualification,knockout}.
 * settings.officialCompetition Group 2 fields are LEGACY_COMPATIBILITY_DRAFT only.
 */
export const CONTENT_GROUP2_FIELD_AUTHORITY = Object.freeze({
  groupStageEnabled: "CONTENT_COMPETITION_RULES",
  groupCount: "CONTENT_COMPETITION_RULES",
  maxUnitsPerGroup: "CONTENT_COMPETITION_RULES",
  roundRobinPolicy: "CONTENT_COMPETITION_RULES",
  allowUnevenGroups: "CONTENT_COMPETITION_RULES",
  totalQualifiers: "CONTENT_COMPETITION_RULES",
  directQualifiersPerGroup: "CONTENT_COMPETITION_RULES",
  wildcardSlots: "CONTENT_COMPETITION_RULES_STRUCTURAL",
  knockoutEnabled: "CONTENT_COMPETITION_RULES",
  qualifierCount: "CONTENT_COMPETITION_RULES",
  pairingPolicy: "CONTENT_COMPETITION_RULES_METADATA",
  avoidSameGroupFirstRound: "CONTENT_COMPETITION_RULES_METADATA",
});

export const LEGACY_GROUP2_FIELD_CLASS = Object.freeze({
  officialCompetition: "LEGACY_COMPATIBILITY_DRAFT",
  groupCount: "LEGACY_COMPATIBILITY_DRAFT",
  qualifiersPerGroup: "LEGACY_COMPATIBILITY_DRAFT",
  totalQualifiers: "LEGACY_COMPATIBILITY_DRAFT",
  wildcardSlots: "LEGACY_COMPATIBILITY_DRAFT",
});

export const GROUP2_WILDCARD_RESPONSIBILITY = Object.freeze({
  GROUP2: "STRUCTURAL_SLOT_COUNT_ONLY",
  GROUP4: "CANDIDATE_RANKING_AND_CROSS_GROUP_ORDER",
});

export const CONTENT_KNOCKOUT_PAIRING_POLICY = Object.freeze({
  CROSS_GROUP: "CROSS_GROUP",
  SEEDED: "SEEDED",
  RANDOM: "RANDOM",
});

/** Runtime truth: Official classic bracket placement remains hardcoded CROSS_GROUP. */
export const CONTENT_KNOCKOUT_PAIRING_RUNTIME = Object.freeze({
  runtimeSupported: CONTENT_KNOCKOUT_PAIRING_POLICY.CROSS_GROUP,
  runtimeDeferred: Object.freeze([
    CONTENT_KNOCKOUT_PAIRING_POLICY.SEEDED,
    CONTENT_KNOCKOUT_PAIRING_POLICY.RANDOM,
  ]),
  seededRuntimeClaimedSupported: false,
  randomRuntimeClaimedSupported: false,
});

export const CONTENT_ROUND_ROBIN_RUNTIME = Object.freeze({
  SINGLE: "SUPPORTED",
  DOUBLE: "DEFERRED",
  doubleRuntimeEnabled: false,
});

/**
 * Sole-event inference classification (G1-E).
 * MUTATION / Official business runtime must NOT use this.
 * DISPLAY/READ may opt-in with allowSoleEventInference=true when events.length === 1.
 */
export const SOLE_EVENT_COMPATIBILITY = Object.freeze({
  class: "SOLE_EVENT_COMPATIBILITY",
  allowedForMutation: false,
  allowedForOfficialBusinessRuntime: false,
  allowedForDisplayRead: true,
  neverWhenMultiContent: true,
});

/** Runtime projection unit labels (not persisted schema). */
export const CONTENT_CAPACITY_RUNTIME_UNIT = Object.freeze({
  PARTICIPANT: "PARTICIPANT",
  PAIR: "PAIR",
});

/**
 * Seeding policy is Content-persisted POLICY metadata only.
 * It is NOT pair-formation, group-draw, rating, or ranking authority.
 *
 * Allowed future Official/Open consumer (when a canonical KO placer exists):
 *   KNOCKOUT_PLACEMENT
 *
 * Forbidden consumers (hard scope lock):
 *   Open individual pair formation
 *   Open fixed-pair re-pairing
 *   AI Balance pair formation
 *   Open/AI Balance group-draw ranking
 *
 * PR #459 knockout admission (GROUP_STAGE_BYPASS / DIRECT_KNOCKOUT_ENTRY /
 * KNOCKOUT_BYE) is a separate admission concept — not seeding/placement.
 */
export const CONTENT_SEEDING_POLICY = Object.freeze({
  NONE: "NONE",
  MANUAL: "MANUAL",
  RANKING: "RANKING",
  RATING: "RATING",
});

export const CONTENT_SEEDING_SCOPE = Object.freeze({
  OPEN_INDIVIDUAL_PAIR_FORMATION: false,
  OPEN_FIXED_PAIR_REPAIRING: false,
  AI_BALANCE_PAIR_FORMATION: false,
  OPEN_OR_AI_BALANCE_GROUP_DRAW_RANKING: false,
  BRACKET_OR_KO_PLACEMENT: "DEFERRED",
});

export const CONTENT_SEEDING_RUNTIME_STATUS = Object.freeze({
  SUPPORTED: "SUPPORTED",
  PARTIAL: "PARTIAL",
  DEFERRED: "DEFERRED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
});

/** PR #459 admission concepts — never treat as seeding/placement. */
export const CONTENT_SEEDING_VS_ADMISSION = Object.freeze({
  GROUP_STAGE_BYPASS: "ADMISSION_NOT_SEEDING",
  DIRECT_KNOCKOUT_ENTRY: "ADMISSION_NOT_SEEDING",
  KNOCKOUT_BYE: "ADMISSION_NOT_SEEDING",
  note: "Knockout admission ≠ bracket seeding/placement.",
});

function normalizeContentSeedingPolicy(value) {
  const raw = String(value || CONTENT_SEEDING_POLICY.NONE)
    .trim()
    .toUpperCase();
  if (
    raw === CONTENT_SEEDING_POLICY.NONE ||
    raw === CONTENT_SEEDING_POLICY.MANUAL ||
    raw === CONTENT_SEEDING_POLICY.RANKING ||
    raw === CONTENT_SEEDING_POLICY.RATING
  ) {
    return raw;
  }
  return CONTENT_SEEDING_POLICY.NONE;
}

/**
 * Central Content seeding scope resolution (G1-D).
 * Policy authority only — no pair formation / group draw / KO execution.
 * KO allowedScopes stay empty until a proven Official/Open placer exists.
 */
export function resolveContentSeedingScope(tournament, options = {}) {
  const eventId = trim(options.eventId);
  let policy = normalizeContentSeedingPolicy(options.seedingPolicy);
  let source = "OPTION";

  if (options.seedingPolicy == null && (tournament || eventId)) {
    const group1 = resolveContentGroup1Settings(tournament, {
      eventId: eventId || undefined,
      allowSoleEventInference: options.allowSoleEventInference,
    });
    if (group1.ok) {
      policy = normalizeContentSeedingPolicy(group1.seedingPolicy);
      source = group1.source;
      return finalizeSeedingScope(policy, source, group1.eventId);
    }
  }

  return finalizeSeedingScope(policy, source, eventId || null);
}

function finalizeSeedingScope(policy, source, eventId) {
  // No Official/Open KO placement consumer is wired to Content seedingPolicy yet.
  // MANUAL has no persisted manual seed-order structure in this wave.
  // RANKING/RATING would need Ranking/Rating adapters as evidence only — still deferred.
  const enumStatus =
    policy === CONTENT_SEEDING_POLICY.NONE
      ? CONTENT_SEEDING_RUNTIME_STATUS.NOT_APPLICABLE
      : CONTENT_SEEDING_RUNTIME_STATUS.DEFERRED;

  return Object.freeze({
    ok: true,
    eventId: eventId || null,
    policy,
    source,
    authority: CONTENT_GROUP1_FIELD_AUTHORITY.seedingPolicy,
    allowedScopes: Object.freeze([]), // KO placer not proven — keep empty (fail-closed)
    forbiddenScopes: Object.freeze([
      "OPEN_INDIVIDUAL_PAIR_FORMATION",
      "OPEN_FIXED_PAIR_REPAIRING",
      "AI_BALANCE_PAIR_FORMATION",
      "OPEN_OR_AI_BALANCE_GROUP_DRAW_RANKING",
    ]),
    scopeLock: CONTENT_SEEDING_SCOPE,
    enumStatus,
    koRuntime: CONTENT_SEEDING_SCOPE.BRACKET_OR_KO_PLACEMENT,
    manualSeedPersistenceExists: false,
    rankingAuthority: "CANONICAL_RANKING_ADAPTER",
    ratingAuthority: "CANONICAL_RATING_ADAPTER",
    admissionSeparateFromSeeding: CONTENT_SEEDING_VS_ADMISSION,
    pairFormationAuthority: false,
    groupDrawAuthority: false,
  });
}

/**
 * Seeding is not an Open/AI Balance pair-formation authority.
 */
export function isContentSeedingAllowedForPairFormation() {
  return (
    CONTENT_SEEDING_SCOPE.OPEN_INDIVIDUAL_PAIR_FORMATION === true ||
    CONTENT_SEEDING_SCOPE.OPEN_FIXED_PAIR_REPAIRING === true ||
    CONTENT_SEEDING_SCOPE.AI_BALANCE_PAIR_FORMATION === true
  );
}

export function assertContentSeedingNotPairFormationAuthority(consumer = "") {
  if (isContentSeedingAllowedForPairFormation()) return { ok: true };
  const label = trim(consumer) || "caller";
  // Soft guard — does not throw (would change pair-formation runtime if thrown today).
  return {
    ok: false,
    code: "SEEDING_NOT_PAIR_FORMATION_AUTHORITY",
    error: `seedingPolicy must not drive pair formation (${label}). Open individual = RANDOM; fixed pair = registered pair; AI Balance = existing engine.`,
    scope: CONTENT_SEEDING_SCOPE,
  };
}

/**
 * Seeding is not Open/AI Balance group-draw ranking authority.
 */
export function isContentSeedingAllowedForGroupDraw() {
  return CONTENT_SEEDING_SCOPE.OPEN_OR_AI_BALANCE_GROUP_DRAW_RANKING === true;
}

export function assertContentSeedingNotGroupDrawAuthority(consumer = "") {
  if (isContentSeedingAllowedForGroupDraw()) return { ok: true };
  const label = trim(consumer) || "caller";
  return {
    ok: false,
    code: "SEEDING_NOT_GROUP_DRAW_AUTHORITY",
    error: `seedingPolicy must not sort/rank units for Official Open/AI Balance group draw (${label}). Group draw remains rating-neutral RANDOM.`,
    scope: CONTENT_SEEDING_SCOPE,
  };
}

/**
 * Future KO/bracket placement gate. Returns ok:false until a proven consumer exists.
 * Does not implement placement.
 */
export function assertContentSeedingKnockoutPlacementReady(consumer = "") {
  if (CONTENT_SEEDING_SCOPE.BRACKET_OR_KO_PLACEMENT === true) {
    return { ok: true };
  }
  const label = trim(consumer) || "caller";
  return {
    ok: false,
    code: "SEEDING_KO_RUNTIME_DEFERRED",
    error: `Content seedingPolicy KO/bracket placement is deferred (${label}). Admission (PR #459) ≠ seeding.`,
    scope: CONTENT_SEEDING_SCOPE,
    admissionSeparateFromSeeding: CONTENT_SEEDING_VS_ADMISSION,
  };
}

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
      return normalizeContentSeedingPolicy(input?.seedingPolicy);
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
        // Fail-closed: persist SINGLE only. DOUBLE remains DEFERRED — do not store
        // DOUBLE as if it were operational authority.
        String(groupStageIn.roundRobinPolicy || "SINGLE").toUpperCase() === "DOUBLE"
          ? "SINGLE"
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
 * Compatibility read / bootstrap only. Not ongoing inheritance. Not auto-persisted.
 * Not active Group 2 authority when CONTENT_EXPLICIT exists.
 *
 * eligibility here may be seeded from settings.eligibilityRules
 * (CONFLICTING_LEGACY_RUNTIME) for draft display only — Content Save must
 * persist to events[].competitionRules.eligibility, not dual-write back.
 *
 * Group 2 fields (groupCount / qualifiersPerGroup / totalQualifiers / wildcardSlots)
 * prefill unmaterialized Content only. Content Save materializes
 * events[].competitionRules — never re-authors settings.officialCompetition.
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
  // G1-E: sole-event inference is opt-in DISPLAY/READ compatibility only.
  // Default false — Official business/mutation must pass explicit eventId.
  const allowSoleEventInference = options.allowSoleEventInference === true;
  if (!wanted) {
    if (allowSoleEventInference && events.length === 1) {
      return {
        ok: true,
        event: events[0],
        eventId: String(events[0].id),
        inferredSoleEvent: true,
        compatibilityClass: SOLE_EVENT_COMPATIBILITY.class,
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
  return {
    ok: true,
    event,
    eventId: wanted,
    inferredSoleEvent: false,
    compatibilityClass: null,
  };
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
 *
 * G1-E: eventId required by default. Sole-event inference only when caller
 * explicitly sets allowSoleEventInference=true (DISPLAY/READ compatibility).
 */
export function resolveContentCompetitionRules(tournament, options = {}) {
  const scoped = resolveExplicitEvent(tournament, options.eventId, {
    allowSoleEventInference: options.allowSoleEventInference === true,
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
      compatibilityClass: scoped.compatibilityClass,
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
      compatibilityClass: scoped.compatibilityClass,
      rules,
      source: CONTENT_RULES_SOURCE.LEGACY_COMPATIBILITY_DRAFT,
      persistedSource: "settings.officialCompetition (legacy compatibility only)",
      legacyActiveAuthority: false,
      legacyClass: LEGACY_GROUP1_FIELD_CLASS.officialCompetition,
      note: "Legacy tournament blob used as draft only until Content Save materializes event.competitionRules. Not active Group 2 authority.",
    };
  }

  const rules = deriveCanonicalDefaultContentRules();
  return {
    ok: true,
    event: scoped.event,
    eventId: scoped.eventId,
    inferredSoleEvent: scoped.inferredSoleEvent === true,
    compatibilityClass: scoped.compatibilityClass,
    rules,
    source: CONTENT_RULES_SOURCE.CANONICAL_SYSTEM_DEFAULT,
    persistedSource: null,
    legacyActiveAuthority: false,
  };
}

/**
 * Group 1 Content resolver surface (registration / capacity / eligibility / seeding).
 * Eligibility bounds are Content authority when CONTENT_EXPLICIT (G1-C runtime).
 * Does NOT read tournament.settings.eligibilityRules as Content skill/rating authority.
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

function knockoutPairingRuntimeMetadata(pairingPolicy) {
  const configured = ["CROSS_GROUP", "SEEDED", "RANDOM"].includes(
    String(pairingPolicy || "").toUpperCase()
  )
    ? String(pairingPolicy).toUpperCase()
    : CONTENT_KNOCKOUT_PAIRING_POLICY.CROSS_GROUP;
  const runtimeSupported = CONTENT_KNOCKOUT_PAIRING_RUNTIME.runtimeSupported;
  return Object.freeze({
    policyConfigured: configured,
    runtimeSupported,
    runtimeDeferred: CONTENT_KNOCKOUT_PAIRING_RUNTIME.runtimeDeferred,
    runtimeExecuted: runtimeSupported,
    seededRuntimeClaimedSupported:
      CONTENT_KNOCKOUT_PAIRING_RUNTIME.seededRuntimeClaimedSupported,
    randomRuntimeClaimedSupported:
      CONTENT_KNOCKOUT_PAIRING_RUNTIME.randomRuntimeClaimedSupported,
  });
}

/**
 * Group 2 Content resolver surface (group stage / qualification / knockout structure).
 * CONTENT_EXPLICIT wins. Legacy draft never overrides Content.
 * G2-B: groupStageEnabled / groupCount / maxUnitsPerGroup / allowUnevenGroups
 * are enforced at Official/Open group-draw runtime (see validateContentGroupStageDrawStructure).
 * Qualification / knockout / DOUBLE round-robin remain deferred.
 */
export function resolveContentGroup2Settings(tournament, options = {}) {
  const resolved = resolveContentCompetitionRules(tournament, {
    eventId: options.eventId,
    allowSoleEventInference: options.allowSoleEventInference,
  });
  if (!resolved.ok) return resolved;

  const { rules, source, eventId, event, inferredSoleEvent } = resolved;
  const pairingRuntime = knockoutPairingRuntimeMetadata(rules.knockout.pairingPolicy);
  return {
    ok: true,
    eventId,
    event,
    inferredSoleEvent: inferredSoleEvent === true,
    source,
    authority: CONTENT_GROUP2_FIELD_AUTHORITY,
    groupStage: rules.groupStage,
    qualification: rules.qualification,
    knockout: rules.knockout,
    wildcardScope: GROUP2_WILDCARD_RESPONSIBILITY,
    knockoutPairingRuntime: pairingRuntime,
    roundRobinRuntime: Object.freeze({
      policyConfigured: rules.groupStage.roundRobinPolicy,
      runtimeSupported: "SINGLE",
      doubleRuntimeEnabled: CONTENT_ROUND_ROBIN_RUNTIME.doubleRuntimeEnabled,
      doubleStatus: CONTENT_ROUND_ROBIN_RUNTIME.DOUBLE,
    }),
    maxUnitsPerGroupRuntime: "RUNTIME_ENFORCED",
    allowUnevenGroupsRuntime: "RUNTIME_ENFORCED",
    groupStageEnabledRuntime: "RUNTIME_ENFORCED",
    groupCountRuntime: "RUNTIME_ENFORCED",
    qualificationSlotMathRuntime: "RUNTIME_ENFORCED",
    directQualifiersRuntime: "RUNTIME_ENFORCED",
    wildcardCandidateRuntime: "DEFERRED_TO_G2_D",
    knockoutEnabledRuntime: "DEFERRED_TO_G2_E",
    qualifierCountRuntime: "DEFERRED_TO_G2_E",
    avoidSameGroupRuntime: "DEFERRED_TO_G2_E",
    legacyClassification: LEGACY_GROUP2_FIELD_CLASS,
    legacyActiveAuthority: false,
    persistedSource: resolved.persistedSource,
    compatibilityClass: resolved.compatibilityClass,
  };
}

function countGroupDrawUnits(group) {
  if (Array.isArray(group?.entryIds) && group.entryIds.length > 0) {
    return group.entryIds.length;
  }
  if (Array.isArray(group?.entries) && group.entries.length > 0) {
    return group.entries.length;
  }
  return 0;
}

/**
 * Pre-allocation structural gate for Official/Open Group Draw (G2-B).
 * Constrains the existing allocator — does not replace it.
 *
 * Codes: EVENT_REQUIRED | GROUP_STAGE_DISABLED | INVALID_GROUP_COUNT |
 *        GROUP_COUNT_TOO_LARGE | GROUP_CAPACITY_EXCEEDED | UNEVEN_GROUPS_NOT_ALLOWED
 */
export function validateContentGroupStageDrawStructure(tournament, options = {}) {
  const eventId = trim(options.eventId);
  if (!eventId) {
    return {
      ok: false,
      code: "EVENT_REQUIRED",
      error: "Chọn nội dung tường minh (eventId) trước khi chia bảng.",
    };
  }

  const group2 = resolveContentGroup2Settings(tournament, {
    eventId,
    allowSoleEventInference: false,
  });
  if (!group2.ok) return group2;

  const groupStage = group2.groupStage || {};
  if (groupStage.groupStageEnabled === false) {
    return {
      ok: false,
      code: "GROUP_STAGE_DISABLED",
      error:
        "Nội dung này không có vòng bảng (groupStageEnabled=false) — không chia bảng. Direct knockout / bypass thuộc G2-F.",
      eventId,
      source: group2.source,
      groupStage,
    };
  }

  const groupCount = Number(groupStage.groupCount);
  if (!Number.isInteger(groupCount) || groupCount < 1) {
    return {
      ok: false,
      code: "INVALID_GROUP_COUNT",
      error: "Số bảng (groupCount) chưa cấu hình hợp lệ trên Nội dung đang chọn.",
      eventId,
      source: group2.source,
      groupStage,
    };
  }

  const eligibleUnitCount = Number(options.eligibleUnitCount);
  if (!Number.isFinite(eligibleUnitCount) || eligibleUnitCount < 0) {
    return {
      ok: false,
      code: "UNITS_MISSING",
      error: "Thiếu số đơn vị đủ điều kiện để kiểm tra cấu trúc bảng.",
      eventId,
      source: group2.source,
    };
  }

  if (groupCount > eligibleUnitCount) {
    return {
      ok: false,
      code: "GROUP_COUNT_TOO_LARGE",
      error: `Số bảng (${groupCount}) lớn hơn số đơn vị (${eligibleUnitCount}).`,
      eventId,
      source: group2.source,
      groupStage,
      eligibleUnitCount,
      groupCount,
    };
  }

  const maxUnitsPerGroup =
    groupStage.maxUnitsPerGroup != null ? Number(groupStage.maxUnitsPerGroup) : null;
  if (maxUnitsPerGroup != null && Number.isFinite(maxUnitsPerGroup) && maxUnitsPerGroup >= 1) {
    const capacity = groupCount * Math.floor(maxUnitsPerGroup);
    if (eligibleUnitCount > capacity) {
      return {
        ok: false,
        code: "GROUP_CAPACITY_EXCEEDED",
        error: `Số đơn vị (${eligibleUnitCount}) vượt sức chứa cấu trúc bảng (${groupCount} × ${Math.floor(maxUnitsPerGroup)} = ${capacity}). Không tạo thêm bảng.`,
        eventId,
        source: group2.source,
        groupStage,
        eligibleUnitCount,
        groupCount,
        maxUnitsPerGroup: Math.floor(maxUnitsPerGroup),
        structuralCapacity: capacity,
      };
    }
  }

  const allowUnevenGroups = groupStage.allowUnevenGroups !== false;
  if (!allowUnevenGroups && eligibleUnitCount % groupCount !== 0) {
    return {
      ok: false,
      code: "UNEVEN_GROUPS_NOT_ALLOWED",
      error: `Bảng không đều không được phép: ${eligibleUnitCount} đơn vị không chia hết cho ${groupCount} bảng.`,
      eventId,
      source: group2.source,
      groupStage,
      eligibleUnitCount,
      groupCount,
      remainder: eligibleUnitCount % groupCount,
    };
  }

  return {
    ok: true,
    eventId,
    source: group2.source,
    groupStage,
    groupCount,
    maxUnitsPerGroup:
      maxUnitsPerGroup != null && Number.isFinite(maxUnitsPerGroup) && maxUnitsPerGroup >= 1
        ? Math.floor(maxUnitsPerGroup)
        : null,
    allowUnevenGroups,
    eligibleUnitCount,
    structuralCapacity:
      maxUnitsPerGroup != null && Number.isFinite(maxUnitsPerGroup) && maxUnitsPerGroup >= 1
        ? groupCount * Math.floor(maxUnitsPerGroup)
        : null,
    roundRobinPolicy: groupStage.roundRobinPolicy || "SINGLE",
  };
}

/**
 * Post-allocation check against Content groupStage (G2-B).
 * Fail closed if the existing allocator violated max size or balance policy.
 */
export function assertAllocatedGroupsMatchContentGroupStage(groups = [], groupStage = {}) {
  const list = Array.isArray(groups) ? groups : [];
  const sizes = list.map(countGroupDrawUnits);
  const maxUnitsPerGroup =
    groupStage?.maxUnitsPerGroup != null ? Number(groupStage.maxUnitsPerGroup) : null;

  if (maxUnitsPerGroup != null && Number.isFinite(maxUnitsPerGroup) && maxUnitsPerGroup >= 1) {
    const cap = Math.floor(maxUnitsPerGroup);
    const oversized = sizes.findIndex((size) => size > cap);
    if (oversized >= 0) {
      return {
        ok: false,
        code: "GROUP_CAPACITY_EXCEEDED",
        error: `Bảng sau chia vượt maxUnitsPerGroup (${cap}): bảng #${oversized + 1} có ${sizes[oversized]} đơn vị.`,
        sizes,
        maxUnitsPerGroup: cap,
      };
    }
  }

  if (sizes.length > 0) {
    const largest = Math.max(...sizes);
    const smallest = Math.min(...sizes);
    const allowUnevenGroups = groupStage?.allowUnevenGroups !== false;
    if (allowUnevenGroups) {
      if (largest - smallest > 1) {
        return {
          ok: false,
          code: "UNEVEN_GROUPS_BALANCE_VIOLATED",
          error: `Phân bổ bảng không cân: lớn nhất ${largest}, nhỏ nhất ${smallest} (chênh lệch phải ≤ 1).`,
          sizes,
          largest,
          smallest,
        };
      }
    } else if (largest !== smallest) {
      return {
        ok: false,
        code: "UNEVEN_GROUPS_NOT_ALLOWED",
        error: `Bảng không đều sau chia (sizes=${sizes.join(",")}) trong khi allowUnevenGroups=false.`,
        sizes,
      };
    }
  }

  return {
    ok: true,
    sizes,
    balanced: sizes.length === 0 || Math.max(...sizes) - Math.min(...sizes) <= 1,
  };
}

/**
 * Thin Content → Adapter A qualification slot-math wrapper (G2-C).
 * Does not invent a second formula. Does not select wildcard candidates.
 */
export function resolveContentQualificationPlan(tournament, options = {}) {
  const eventId = trim(options.eventId);
  if (!eventId) {
    return {
      ok: false,
      code: "EVENT_REQUIRED",
      error: "Chọn nội dung tường minh (eventId) trước khi xét suất đi tiếp.",
    };
  }

  const group2 = resolveContentGroup2Settings(tournament, {
    eventId,
    allowSoleEventInference: false,
  });
  if (!group2.ok) return group2;

  const groupStage = group2.groupStage || {};
  const qualification = group2.qualification || {};
  const plan = deriveQualificationPlan({
    groupStageEnabled: groupStage.groupStageEnabled !== false,
    groupCount: groupStage.groupCount,
    totalQualifiers: qualification.totalQualifiers,
    directQualifiersPerGroup: qualification.directQualifiersPerGroup,
  });

  if (!plan.ok) {
    return {
      ok: false,
      code: plan.code || "INVALID_QUALIFICATION_PLAN",
      error:
        plan.message ||
        "Cấu hình suất đi tiếp không hợp lệ (groupCount × direct > totalQualifiers).",
      eventId,
      source: group2.source,
      plan,
      groupStage,
      qualification,
      authority: CONTENT_GROUP2_FIELD_AUTHORITY,
    };
  }

  return {
    ok: true,
    eventId,
    source: group2.source,
    authority: CONTENT_GROUP2_FIELD_AUTHORITY,
    groupStage,
    qualification,
    plan,
    groupCount: plan.groupCount,
    directQualifiersPerGroup: plan.directQualifiersPerGroup,
    directSlots: plan.directSlots,
    totalQualifiers: plan.totalQualifiers,
    wildcardSlots: plan.wildcardSlots,
    groupStageEnabled: plan.groupStageEnabled === true,
    formula: plan.details?.formula || null,
    wildcardCandidateSelection: false,
    wildcardRankingDeferredToGroup4: true,
  };
}

/** Content eligibility bounds only. */
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
 * Map Content eligibility → eligibilityEngine rules shape for Official registration.
 * CONTENT_EXPLICIT: skill/rating bounds from Content; other dimensions keep legacy blob.
 * Otherwise: full tournament.settings.eligibilityRules (LEGACY_RUNTIME_COMPATIBILITY).
 *
 * Does not dual-write. Does not invent rating/skill values.
 */
function contentBoundOrNull(value) {
  const n = decimalOrNull(value);
  // Align with eligibilityEngine empty-input sentinel (0 is not a product floor).
  return n === 0 ? null : n;
}

export function resolveOfficialRegistrationEligibilityRules(tournament, options = {}) {
  const wanted = trim(options.eventId);
  // G1-E: Official business eligibility requires explicit eventId (no sole-event default).
  if (!wanted) {
    return {
      ok: false,
      code: "EVENT_REQUIRED",
      error: "Chọn nội dung tường minh (eventId) trước khi kiểm tra điều kiện.",
    };
  }

  const content = resolveContentEligibilityBounds(tournament, {
    eventId: wanted,
    allowSoleEventInference: false,
  });
  if (!content.ok) return content;

  const eligibility = content.eligibility || {};
  const minLevel = contentBoundOrNull(eligibility.minLevel);
  const maxLevel = contentBoundOrNull(eligibility.maxLevel);
  const minRating = contentBoundOrNull(eligibility.minRating);
  const maxRating = contentBoundOrNull(eligibility.maxRating);

  if (minLevel != null && maxLevel != null && minLevel > maxLevel) {
    return {
      ok: false,
      code: "INVALID_ELIGIBILITY_POLICY",
      error: `Chính sách trình độ không hợp lệ: minLevel (${minLevel}) > maxLevel (${maxLevel}).`,
      eventId: content.eventId,
      source: content.source,
    };
  }
  if (minRating != null && maxRating != null && minRating > maxRating) {
    return {
      ok: false,
      code: "INVALID_ELIGIBILITY_POLICY",
      error: `Chính sách rating không hợp lệ: minRating (${minRating}) > maxRating (${maxRating}).`,
      eventId: content.eventId,
      source: content.source,
    };
  }

  const legacy = getEligibilityRules(tournament);

  if (content.source === CONTENT_RULES_SOURCE.CONTENT_EXPLICIT) {
    const rules = normalizeEligibilityRules({
      ...legacy,
      skill: {
        enabled: minLevel != null || maxLevel != null,
        minLevel,
        maxLevel,
      },
      rating: {
        enabled: minRating != null || maxRating != null,
        minRating,
        maxRating,
      },
    });
    return {
      ok: true,
      eventId: content.eventId,
      source: "CONTENT",
      contentRulesSource: content.source,
      rules,
      skillRatingAuthority: CONTENT_GROUP1_FIELD_AUTHORITY.eligibility,
      hasSkillBounds: minLevel != null || maxLevel != null,
      hasRatingBounds: minRating != null || maxRating != null,
      ratingValueAuthority: "CANONICAL_RATING_ADAPTER",
      legacyEligibilityClass: LEGACY_GROUP1_FIELD_CLASS.eligibilityRules,
    };
  }

  return {
    ok: true,
    eventId: content.eventId,
    source: "LEGACY_RUNTIME_COMPATIBILITY",
    contentRulesSource: content.source,
    rules: legacy,
    skillRatingAuthority: LEGACY_GROUP1_FIELD_CLASS.eligibilityRules,
    hasSkillBounds:
      legacy.skill?.minLevel != null || legacy.skill?.maxLevel != null,
    hasRatingBounds:
      legacy.rating?.minRating != null || legacy.rating?.maxRating != null,
    ratingValueAuthority: "CANONICAL_RATING_ADAPTER",
    legacyEligibilityClass: LEGACY_GROUP1_FIELD_CLASS.eligibilityRules,
  };
}

/**
 * True when Content (or legacy fallback) configures rating eligibility bounds
 * for the selected event — activates Canonical Rating Adapter evidence.
 */
export function contentHasRatingEligibilityBounds(tournament, options = {}) {
  const resolved = resolveOfficialRegistrationEligibilityRules(tournament, options);
  if (!resolved.ok) return false;
  return resolved.hasRatingBounds === true;
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
        patch.groupCount ??
        draftSource.groupCount ??
        draftSource.groupStage?.groupCount ??
        current.groupStage.groupCount,
      groupStageEnabled:
        patch.groupStageEnabled ??
        draftSource.groupStageEnabled ??
        draftSource.groupStage?.groupStageEnabled ??
        current.groupStage.groupStageEnabled,
      maxUnitsPerGroup:
        patch.maxUnitsPerGroup ??
        draftSource.maxUnitsPerGroup ??
        draftSource.groupStage?.maxUnitsPerGroup ??
        current.groupStage.maxUnitsPerGroup,
      allowUnevenGroups:
        patch.allowUnevenGroups ??
        draftSource.allowUnevenGroups ??
        draftSource.groupStage?.allowUnevenGroups ??
        current.groupStage.allowUnevenGroups,
      roundRobinPolicy:
        patch.roundRobinPolicy ??
        draftSource.roundRobinPolicy ??
        draftSource.groupStage?.roundRobinPolicy ??
        current.groupStage.roundRobinPolicy,
    },
    qualification: {
      ...current.qualification,
      ...(draftSource.qualification || {}),
      directQualifiersPerGroup:
        patch.qualifiersPerGroup ??
        draftSource.qualifiersPerGroup ??
        draftSource.qualification?.directQualifiersPerGroup ??
        current.qualification.directQualifiersPerGroup,
      totalQualifiers:
        patch.totalQualifiers ??
        draftSource.totalQualifiers ??
        draftSource.qualification?.totalQualifiers ??
        current.qualification.totalQualifiers,
      wildcardSlots:
        patch.wildcardSlots ??
        draftSource.wildcardSlots ??
        draftSource.qualification?.wildcardSlots ??
        current.qualification.wildcardSlots,
    },
    knockout: {
      ...current.knockout,
      ...(draftSource.knockout || {}),
      knockoutEnabled:
        patch.knockoutEnabled ??
        draftSource.knockoutEnabled ??
        draftSource.knockout?.knockoutEnabled ??
        current.knockout.knockoutEnabled,
      pairingPolicy:
        patch.pairingPolicy ??
        draftSource.pairingPolicy ??
        draftSource.knockout?.pairingPolicy ??
        current.knockout.pairingPolicy,
      avoidSameGroupFirstRound:
        patch.avoidSameGroupFirstRound ??
        draftSource.avoidSameGroupFirstRound ??
        draftSource.knockout?.avoidSameGroupFirstRound ??
        current.knockout.avoidSameGroupFirstRound,
      qualifierCount:
        patch.qualifierCount ??
        draftSource.qualifierCount ??
        draftSource.knockout?.qualifierCount ??
        current.knockout.qualifierCount,
    },
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
    group2: {
      groupStage: nextRules.groupStage,
      qualification: nextRules.qualification,
      knockout: nextRules.knockout,
    },
  };
}

export function resolveContentQualifiersPerGroup(tournament, options = {}) {
  if (options.qualifiersPerGroup != null) {
    return toPositiveInt(options.qualifiersPerGroup, DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP);
  }
  const group2 = resolveContentGroup2Settings(tournament, {
    eventId: options.eventId,
    allowSoleEventInference: options.allowSoleEventInference,
  });
  if (!group2.ok) {
    return DEFAULT_OFFICIAL_QUALIFIERS_PER_GROUP;
  }
  return group2.qualification.directQualifiersPerGroup;
}

export function resolveContentGroupCount(tournament, options = {}) {
  if (options.groupCount != null) {
    return toPositiveInt(options.groupCount, 4);
  }
  const group2 = resolveContentGroup2Settings(tournament, {
    eventId: options.eventId,
    allowSoleEventInference: options.allowSoleEventInference,
  });
  if (!group2.ok) return 4;
  return group2.groupStage.groupCount;
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
