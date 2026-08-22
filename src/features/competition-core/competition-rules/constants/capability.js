/**
 * Capability truth model for Canonical Competition Rules & Format.
 *
 * POLICY_SUPPORTED ≠ EXECUTION_SUPPORTED.
 * Do not advertise operational support merely because the profile schema can represent a value.
 */

export const CAPABILITY_STATE = Object.freeze({
  SUPPORTED: "SUPPORTED",
  UNSUPPORTED: "UNSUPPORTED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  DEFERRED: "DEFERRED",
  PARTIAL: "PARTIAL",
});

export const CAPABILITY_AXIS = Object.freeze({
  POLICY: "POLICY",
  EXECUTION: "EXECUTION",
});

export const COMPETITION_RULES_CAPABILITY_ID = Object.freeze({
  SCORING_METHOD_RALLY: "SCORING_METHOD_RALLY",
  SCORING_METHOD_SIDE_OUT: "SCORING_METHOD_SIDE_OUT",
  MATCH_SERIES_BEST_OF_1: "MATCH_SERIES_BEST_OF_1",
  MATCH_SERIES_BEST_OF_3: "MATCH_SERIES_BEST_OF_3",
  MATCH_SERIES_BEST_OF_5: "MATCH_SERIES_BEST_OF_5",
  WIN_BY: "WIN_BY",
  POINT_CAP: "POINT_CAP",
  CHANGE_END: "CHANGE_END",
  GROUP_STAGE: "GROUP_STAGE",
  QUALIFICATION_WILDCARD: "QUALIFICATION_WILDCARD",
  IN_GROUP_TIEBREAK: "IN_GROUP_TIEBREAK",
  CROSS_GROUP_WILDCARD_RANKING: "CROSS_GROUP_WILDCARD_RANKING",
  KNOCKOUT: "KNOCKOUT",
  /** Competition unit excluded from group-stage participation (≠ direct entry ≠ bye). */
  GROUP_STAGE_BYPASS: "GROUP_STAGE_BYPASS",
  /** Admitted knockout slot without group standings qualification (≠ seeding ≠ bye). */
  DIRECT_KNOCKOUT_ENTRY: "DIRECT_KNOCKOUT_ENTRY",
  /** Admitted knockout unit skips one round via bracket BYE allocation (≠ direct entry). */
  KNOCKOUT_BYE: "KNOCKOUT_BYE",
  WALKOVER_POLICY: "WALKOVER_POLICY",

  CHECK_IN_POLICY: "CHECK_IN_POLICY",
  SCHEDULE_CONSTRAINTS: "SCHEDULE_CONSTRAINTS",
  COURT_REQUIREMENT: "COURT_REQUIREMENT",
  REFEREE_REQUIREMENT: "REFEREE_REQUIREMENT",
  PUBLICATION_POLICY: "PUBLICATION_POLICY",
  LIFECYCLE_LOCK: "LIFECYCLE_LOCK",
});

/**
 * Evidence-based capability matrix (audit of CORE-16 / CORE-18 / referee-v5 / CE).
 * Update only when runtime evidence changes — never invent operational support.
 */
export const COMPETITION_RULES_CAPABILITY_MATRIX = Object.freeze({
  [COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_RALLY]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "CORE-16 SCORING_SYSTEM.RALLY + referee-v5 rallyScoringEngine",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_SIDE_OUT]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "CORE-16 SCORING_SYSTEM.SIDE_OUT + referee-v5 sideOutScoringEngine",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_1]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "CORE-16 bestOfGames default 1; referee-v5 bestOf default 1",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_3]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.PARTIAL,
    evidence:
      "CORE-16 createScoringFormat accepts bestOfGames=3; live referee multi-game progression not universally certified",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_5]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.DEFERRED,
    evidence: "Schema extensible; no certified multi-set live runtime path",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.WIN_BY]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "CORE-16 winConditions + referee-v5 winBy",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.POINT_CAP]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "CORE-16 maximumScore",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.CHANGE_END]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.PARTIAL,
    executionCondition:
      "Orientation-swap ACK path available on CE referee confirmChangeEnds when sideChangeRequired; not universal across all scoring/referee surfaces",
    supportedRuntimePaths: Object.freeze([
      "competition-engine confirmChangeEnds (orientation STANDARD↔SWAPPED + ledger ACK)",
      "CORE-16 / CE sideSwitchAt due-flag derivation (deriveCanonicalCourtAfterScoring)",
    ]),
    unsupportedOrHintOnlyPaths: Object.freeze([
      "referee-v5 rallyScoringEngine sideSwitchAt hint-only (physical end-switch NOT IMPLEMENTED)",
      "team-tournament rallyScoringEngine changeEndsAt/sideSwitchAt validation/display hint",
    ]),
    evidence:
      "CE confirmChangeEnds executes orientation swap when due; referee-v5 remains hint-only — PARTIAL, not globally SUPPORTED",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.GROUP_STAGE]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "CE pool composition + CORE draw/group engines",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.QUALIFICATION_WILDCARD]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    executionCondition:
      "Shared CE path: composeIndividualPoolKnockout (admission-aware) → composeKnockoutAdmission WILDCARD after CORE-18 ranking; requires group stage + wildcardSlots > 0",
    evidence:
      "CE composeIndividualPoolKnockout wires composeKnockoutAdmission; CORE-18 rankCrossGroupWildcardCandidates",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.IN_GROUP_TIEBREAK]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "CORE-18 standings tieBreakRules execution",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    executionCondition:
      "Normalized criteria from Competition Rules; ranking executed by CORE-18 rankCrossGroupWildcardCandidates (deterministic DRAW_LOTS). Independently callable; also consumed by shared CE admission path.",
    evidence:
      "CORE-18 crossGroupWildcardRanking.js; CE admission path preserves played/wins/scoreFor/scoreAgainst metrics",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.KNOCKOUT]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "CE knockout + CORE match-generation / Team knockout engines",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.GROUP_STAGE_BYPASS]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    executionCondition:
      "Admission-aware composeIndividualPoolKnockout / createPoolKnockoutRuntimeComposition consumes bypass via applyGroupStageBypassPopulation before group allocation. Seed-ordered E2E02 grouping (SNAKE|SEEDED|SERPENTINE) additionally requires compatible CORE-07 groupStageSeedingProjection / competition-wide authoritativeSeedingProjection — no CE index+1 seed fabrication; E2E02 OPEN grouping deferred.",
    evidence:
      "Shared CE pool stage wires groupStageBypass from deriveKnockoutAdmissionPlan; CORE-07 projection consumed for admission-aware group seed order",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.DIRECT_KNOCKOUT_ENTRY]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.PARTIAL,
    executionCondition:
      "SUPPORTED only on shared group-stage pool→KO path when effectiveTargetStage == bracketWideEntryRound, proven entryId, resolved DIRECT identities, and valid group allocation authority (CORE-07 group seeding for current E2E02 strategies). Later-stage DIRECT = DEFERRED. No-group DIRECT / base remainingSlots path = DEFERRED (fail closed). SEEDING ≠ DIRECT.",
    supportedRuntimePaths: Object.freeze([
      "composeIndividualPoolKnockout admission-aware → composeKnockoutAdmission → composeKnockoutStage",
      "createPoolKnockoutRuntimeComposition pass-through of competitionRulesProfile / knockoutAdmissionPlan",
    ]),
    unsupportedOrHintOnlyPaths: Object.freeze([
      "Later-stage DIRECT (targetStage after bracketWideEntryRound)",
      "No-group (groupStageEnabled=false) DIRECT / remainingSlots base population",
      "Fake bye / phantom winner simulation of later-stage admission",
    ]),
    evidence:
      "First-playable DIRECT composed on shared CE admission path only; later-stage and no-group deferred; CE does not assign seeds (CORE-07 authoritative projection or CORE-08 OPEN knockout draw)",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.KNOCKOUT_BYE]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    executionCondition:
      "Single-elimination power-of-two first-round BYEs with BYE_POLICY TOP_SEEDS | BOTTOM_SEEDS | EXPLICIT_PLACEMENTS via CORE-08 calculateByeCount/assignBracketSlots + CORE-09 isBye placements + CE buildKnockoutDrawSnapshotFromQualifiers. Arbitrary mid-bracket / non-first-round BYE configurations are not certified. DIRECT ≠ BYE.",
    supportedRuntimePaths: Object.freeze([
      "CORE-08 calculateByeCount / assignBracketSlots / selectByeSlots",
      "CORE-09 BYE_POLICY + materializeSingleEliminationMatches isBye / isByeMatch",
      "CE buildKnockoutDrawSnapshotFromQualifiers (EXPLICIT_PLACEMENTS default)",
    ]),
    unsupportedOrHintOnlyPaths: Object.freeze([
      "Arbitrary-stage BYE insertion after bracket creation",
      "Fake bye winners / phantom results (DENY — CORE-17 remains result authority)",
      "Using BYE to simulate later-stage DIRECT_KNOCKOUT_ENTRY",
    ]),
    evidence:
      "Shared knockout BYE execution proven for standard SE power-of-two first-round padding — not a new bye engine; distinct from DIRECT",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.WALKOVER_POLICY]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "CORE-18 MATCH_RESULT_TYPE + CORE-17 result validation",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.CHECK_IN_POLICY]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.PARTIAL,
    evidence: "Policy modeled; execution via ops/mobile/court-engine paths vary by mode",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.SCHEDULE_CONSTRAINTS]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "Policy only; schedule-engine / CORE-11 remain mutation authority",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.COURT_REQUIREMENT]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence:
      "Policy projects courtRequirement (venueId / facilityClusterId / physicalCourtIds); assignment execution = CORE-12; physicalCourtId SSOT = 2.2_COURT_OPERATIONS — Adapter A is not physical court SSOT",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.REFEREE_REQUIREMENT]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "Policy only; CORE-13 assignment authority preserved",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.PUBLICATION_POLICY]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.PARTIAL,
    evidence: "CM publication module exists; mode wiring varies",
  }),
  [COMPETITION_RULES_CAPABILITY_ID.LIFECYCLE_LOCK]: Object.freeze({
    policy: CAPABILITY_STATE.SUPPORTED,
    execution: CAPABILITY_STATE.SUPPORTED,
    evidence: "canMutateCompetitionRule uses lifecycle evidence; CORE-15 remains lifecycle mutation authority",
  }),
});
