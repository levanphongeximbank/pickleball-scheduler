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
  IDEMPOTENCY_CONFLICT: "REFEREE_ADAPTER_IDEMPOTENCY_CONFLICT",
  MISSING_CANONICAL_IDENTITY: "REFEREE_ADAPTER_MISSING_CANONICAL_IDENTITY",
  FUZZY_IDENTITY_FORBIDDEN: "REFEREE_ADAPTER_FUZZY_IDENTITY_FORBIDDEN",
  PROPAGATION_REQUIRES_ACCEPTED_RESULT:
    "REFEREE_ADAPTER_PROPAGATION_REQUIRES_ACCEPTED_RESULT",
  DURABLE_DEPENDENCY_REQUIRED: "REFEREE_ADAPTER_DURABLE_DEPENDENCY_REQUIRED",
  IN_MEMORY_PRODUCTION_FORBIDDEN:
    "REFEREE_ADAPTER_IN_MEMORY_PRODUCTION_FORBIDDEN",
  UNOFFICIAL_RESULT_FORBIDDEN: "REFEREE_ADAPTER_UNOFFICIAL_RESULT_FORBIDDEN",
  ASSIGNMENT_REQUIRED: "REFEREE_ADAPTER_ASSIGNMENT_REQUIRED",
  APPEND_ONLY_VIOLATION: "REFEREE_ADAPTER_APPEND_ONLY_VIOLATION",
});

export const REFEREE_ADAPTER_ERROR_CODE_VALUES = Object.freeze(
  Object.values(REFEREE_ADAPTER_ERROR_CODE)
);

export const IN_MEMORY_RUNTIME_CLASSIFICATION = "TEST_DOUBLE_ONLY";

export const PRODUCTION_RUNTIME_CLASSIFICATION =
  "PRODUCTION_CAPABLE_INJECTABLE";

export const DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION =
  "DURABLE_PRODUCTION_COMPOSITION";

export const SCHEMA_FAITHFUL_DRIVER_KIND =
  "schema-faithful-canonical-referee-durable-driver";

export const LIVE_RPC_DRIVER_KIND = "live-rpc-canonical-referee-durable-driver";

export const CANONICAL_REFEREE_STATE_ENVELOPE_VERSION = 1;

export const REFEREE_V5_INTERNAL_COMMIT_RPC = Object.freeze({
  GET_MATCH_STATE: "referee_v5_get_match_state",
  COMMIT_TRANSITION: "referee_v5_commit_match_transition",
  COMMIT_FINALIZATION: "referee_v5_commit_match_finalization",
  MATCH_STATE_ID: "referee_v5_match_state_id",
  CURRENT_USER_HAS_ASSIGNMENT: "referee_v5_current_user_has_assignment",
});

export const CANONICAL_RESULT_LINEAGE = Object.freeze({
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
});

export const LIVE_RESULT_STATUS = Object.freeze({
  CONFIRMED: "confirmed",
  OVERRIDDEN: "overridden",
  DRAFT: "draft",
  VOID: "void",
});
