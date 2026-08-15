/**
 * CompetitionRefereeAdapterContract v1 — frozen identifiers.
 * Hosted under competition-engine/integration (E2E-01 conventions).
 */

export const COMPETITION_REFEREE_ADAPTER_CONTRACT_ID =
  "competition.referee.adapter.v1";

export const COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION = "1.0.0";

export const COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED = true;

export const COMPETITION_REFEREE_MODE = Object.freeze({
  DAILY_PLAY: "DAILY_PLAY",
  INTERNAL: "INTERNAL",
  OFFICIAL: "OFFICIAL",
  TEAM: "TEAM",
});

export const COMPETITION_REFEREE_MODE_VALUES = Object.freeze(
  Object.values(COMPETITION_REFEREE_MODE)
);

/** Canonical CM-01 competition types corresponding to registry modes. */
export const COMPETITION_REFEREE_MODE_TO_TYPE = Object.freeze({
  DAILY_PLAY: "daily_play",
  INTERNAL: "internal_tournament",
  OFFICIAL: "official_tournament",
  TEAM: "team_tournament",
});

export const COMPETITION_TYPE_TO_REFEREE_MODE = Object.freeze({
  daily_play: "DAILY_PLAY",
  internal_tournament: "INTERNAL",
  official_tournament: "OFFICIAL",
  team_tournament: "TEAM",
});

export const REFEREE_ADAPTER_REQUIRED_METHODS = Object.freeze([
  "getCompetitionContext",
  "getMatchContext",
  "getParticipants",
  "getScoringRules",
  "getLifecyclePolicy",
  "getCapabilities",
  "validatePreStart",
  "resolveResultPropagation",
]);

/**
 * Adapter MUST NOT own these authorities. Presence is fail-closed.
 */
export const REFEREE_ADAPTER_FORBIDDEN_METHODS = Object.freeze([
  "assignReferee",
  "persistAssignment",
  "authorizeReferee",
  "resolveRefereeIdentity",
  "applyMatchTransition",
  "completeMatch",
  "recordPoint",
  "calculateScore",
  "persistScore",
  "acceptResult",
  "correctResult",
  "persistResult",
  "appendMatchEvent",
  "persistEvent",
  "reviseResult",
]);

export const REFEREE_ADAPTER_FORBIDDEN_AUTHORITY_KEYS = Object.freeze([
  "scoringEngine",
  "lifecycleEngine",
  "resultEngine",
  "refereeIdentityAuthority",
  "assignmentPersistence",
]);

export const CANONICAL_REFEREE_PERSISTENCE_TABLES = Object.freeze({
  ASSIGNMENTS: "referee_assignments",
  LIVE_STATES: "match_live_states",
  EVENTS: "match_events",
  RESULT_REVISIONS: "match_result_revisions",
  SYNC_MUTATIONS: "match_sync_mutations",
});

export const CANONICAL_REFEREE_AUTHORITY = Object.freeze({
  IDENTITY: "auth.uid",
  ASSIGNMENT: "CORE-13",
  LIFECYCLE: "CORE-15",
  SCORING: "CORE-16",
  EVENT: "append-only match_events + CORE-16 commands",
  RESULT: "CORE-17 accepted active result",
});

export const REFEREE_ADAPTER_ERROR_CODE = Object.freeze({
  UNKNOWN_MODE: "REFEREE_ADAPTER_UNKNOWN_MODE",
  UNKNOWN_MATCH: "REFEREE_ADAPTER_UNKNOWN_MATCH",
  MALFORMED_CONTEXT: "REFEREE_ADAPTER_MALFORMED_CONTEXT",
  MISSING_SCORING_RULES: "REFEREE_ADAPTER_MISSING_SCORING_RULES",
  CROSS_TENANT_CONTEXT: "REFEREE_ADAPTER_CROSS_TENANT_CONTEXT",
  INCOMPATIBLE_CONTRACT_VERSION: "REFEREE_ADAPTER_INCOMPATIBLE_CONTRACT_VERSION",
  MALFORMED_ADAPTER: "REFEREE_ADAPTER_MALFORMED_ADAPTER",
  DUPLICATE_MODE: "REFEREE_ADAPTER_DUPLICATE_MODE",
  DIRECT_SCORE_AUTHORITY_FORBIDDEN:
    "REFEREE_ADAPTER_DIRECT_SCORE_AUTHORITY_FORBIDDEN",
  DIRECT_RESULT_AUTHORITY_FORBIDDEN:
    "REFEREE_ADAPTER_DIRECT_RESULT_AUTHORITY_FORBIDDEN",
  DIRECT_REFEREE_AUTHORITY_FORBIDDEN:
    "REFEREE_ADAPTER_DIRECT_REFEREE_AUTHORITY_FORBIDDEN",
  REGISTRY_FROZEN: "REFEREE_ADAPTER_REGISTRY_FROZEN",
  STALE_WRITE: "REFEREE_ADAPTER_STALE_WRITE",
  MISSING_IDEMPOTENCY: "REFEREE_ADAPTER_MISSING_IDEMPOTENCY",
  MISSING_CANONICAL_IDENTITY: "REFEREE_ADAPTER_MISSING_CANONICAL_IDENTITY",
  FUZZY_IDENTITY_FORBIDDEN: "REFEREE_ADAPTER_FUZZY_IDENTITY_FORBIDDEN",
  PROPAGATION_REQUIRES_ACCEPTED_RESULT:
    "REFEREE_ADAPTER_PROPAGATION_REQUIRES_ACCEPTED_RESULT",
});

export const REFEREE_ADAPTER_ERROR_CODE_VALUES = Object.freeze(
  Object.values(REFEREE_ADAPTER_ERROR_CODE)
);

export const IN_MEMORY_RUNTIME_CLASSIFICATION = "TEST_DOUBLE_ONLY";

export const PRODUCTION_RUNTIME_CLASSIFICATION =
  "PRODUCTION_CAPABLE_INJECTABLE";
