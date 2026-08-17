/**
 * Shared Referee Runtime — match execution initialization policy.
 *
 * This is NOT Tournament match-identity authority.
 * This is NOT CORE-13 assignment authority.
 * This is NOT Competition Referee Adapter Contract #08.
 *
 * Future CORE13 / scripts/core13 fixture provisioners MUST call
 * initializeMatchExecutionState and MUST NOT insert match_live_states.
 */

export const SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION =
  "SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION";

export const MATCH_LIVE_STATES_CLASSIFICATION = "REFEREE_MATCH_EXECUTION_STATE";

export const MATCH_EXECUTION_INIT_RPC =
  "referee_v5_initialize_match_execution_state";

export const MATCH_EXECUTION_INIT_ALLOWED_ACTOR_ROLES = Object.freeze([
  "TRUSTED_SERVER",
  "SYSTEM",
  "ORGANIZER",
  "SUPER_ADMIN",
  "COMPETITION_OPERATOR",
  "TOURNAMENT_DIRECTOR",
  "OWNER",
]);

export const MATCH_EXECUTION_INIT_MODES = Object.freeze([
  "DAILY_PLAY",
  "INTERNAL",
  "OFFICIAL",
  "TEAM",
]);

export const ADAPTER_B_CONTRACT_ID = "competition.referee.adapter.v1";
export const ADAPTER_B_CONTRACT_VERSION = "1.0.0";

export const TERMINAL_LIVE_STATUSES = Object.freeze([
  "completed",
  "cancelled",
  "disputed",
]);

export const ACTIVE_LIVE_STATUSES = Object.freeze([
  "in_progress",
  "paused",
  "game_break",
  "SCORING_ACTIVE",
  "scoring_active",
]);

export const COHERENT_INIT_STATUS = "not_started";
