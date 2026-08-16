/**
 * Court Operations — canonical Court Live Resource Runtime contract.
 *
 * Answers "what is physically happening on the court NOW?"
 * Capacity SSOT remains court_resource_reservations.
 * Booking / Resource Block / Competition match lifecycle remain separate.
 *
 * Cutover default OFF — not activated in Staging/Production during Batch 7.
 */
export const CANONICAL_LIVE_RUNTIME_CONTRACT_VERSION =
  "court-operations.canonical-live-resource-runtime.v1";

export const CANONICAL_LIVE_STATE_TABLE = "court_operations_court_live_states";
export const CANONICAL_RESOURCE_SESSION_TABLE =
  "court_operations_resource_sessions";
export const CANONICAL_LIVE_RUNTIME_COMMAND_LEDGER =
  "court_operations_live_runtime_commands";

export const CANONICAL_LIVE_BEGIN_SESSION_RPC =
  "court_operations_live_begin_resource_session";
export const CANONICAL_LIVE_END_SESSION_RPC =
  "court_operations_live_end_resource_session";
export const CANONICAL_LIVE_SET_OPERATIONAL_STATE_RPC =
  "court_operations_live_set_operational_state";
export const CANONICAL_LIVE_GET_STATE_RPC =
  "court_operations_live_get_court_state";
export const CANONICAL_LIVE_LIST_SESSIONS_RPC =
  "court_operations_live_list_resource_sessions";

/** Occupancy — physical use NOW (not durable capacity). */
export const COURT_OCCUPANCY_STATE = Object.freeze({
  FREE: "free",
  OCCUPIED: "occupied",
});

/**
 * Current operational state — NOW only.
 * Must not be interpreted as an infinite future reservation.
 */
export const COURT_OPERATIONAL_STATE = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE_NOW: "UNAVAILABLE_NOW",
  OUT_OF_SERVICE_NOW: "OUT_OF_SERVICE_NOW",
});

export const RESOURCE_SESSION_STATUS = Object.freeze({
  ACTIVE: "active",
  ENDED: "ended",
});

/** Narrow source vocabulary — opaque sourceId only. */
export const RESOURCE_SESSION_SOURCE_TYPE = Object.freeze({
  BOOKING: "booking",
  DAILY_PLAY: "daily_play",
  COMPETITION: "competition",
  OPERATIONS: "operations",
});

export const LIVE_RUNTIME_CODE = Object.freeze({
  OK: "OK",
  SESSION_ACTIVE_CONFLICT: "SESSION_ACTIVE_CONFLICT",
  OPERATIONAL_STATE_DENIES_USE: "OPERATIONAL_STATE_DENIES_USE",
  CAPACITY_CLAIM_REQUIRED: "CAPACITY_CLAIM_REQUIRED",
  CAPACITY_CLAIM_INVALID: "CAPACITY_CLAIM_INVALID",
  OPERATIONS_POLICY_REQUIRED: "OPERATIONS_POLICY_REQUIRED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_SOURCE_MISMATCH: "SESSION_SOURCE_MISMATCH",
  INVALID_OPERATIONAL_STATE: "INVALID_OPERATIONAL_STATE",
});

/** Architecture lock constants. */
export const COURT_LIVE_RESOURCE_RUNTIME_OWNER = "2.2_COURT_OPERATIONS";
export const COURT_LIVE_RUNTIME_IS_RESERVATION_SSOT = "NO";
export const LIVE_OCCUPANCY_USED_AS_RESERVATION_CONFLICT_AUTHORITY = "NO";
export const COURT_LIVE_RUNTIME_MATCH_LIFECYCLE_AUTHORITY = "NO";
export const COURT_LIVE_RUNTIME_SCORING_AUTHORITY = "NO";
export const COMPETITION_MATCH_ASSIGNMENT_OWNER = "2.13_COMPETITION_ENGINE";

import {
  COURT_CANONICAL_VITE_FLAGS,
  readCourtCanonicalViteFlag,
} from "./courtCanonicalViteFlags.js";

/** Global adoption control — OFF until Staging acceptance. */
export const CANONICAL_COURT_LIVE_RUNTIME_DEFAULT = false;

let liveRuntimeOverride = null;

export function isCanonicalCourtLiveRuntime() {
  if (liveRuntimeOverride === true) return true;
  if (liveRuntimeOverride === false) return false;
  if (readCourtCanonicalViteFlag(COURT_CANONICAL_VITE_FLAGS.COURT_LIVE_RUNTIME)) {
    return true;
  }
  return CANONICAL_COURT_LIVE_RUNTIME_DEFAULT;
}

/** @internal */
export function __setCanonicalCourtLiveRuntimeForTests(enabled) {
  liveRuntimeOverride = enabled === true;
}

/** @internal */
export function __resetCanonicalCourtLiveRuntimeForTests() {
  liveRuntimeOverride = null;
}

export function operationalStateAllowsUse(state) {
  return String(state || "").trim().toUpperCase() === COURT_OPERATIONAL_STATE.AVAILABLE;
}

export function normalizeOperationalState(value) {
  const state = String(value || "").trim().toUpperCase();
  if (state === COURT_OPERATIONAL_STATE.AVAILABLE) {
    return COURT_OPERATIONAL_STATE.AVAILABLE;
  }
  if (state === COURT_OPERATIONAL_STATE.UNAVAILABLE_NOW || state === "LOCKED" || state === "UNAVAILABLE") {
    return COURT_OPERATIONAL_STATE.UNAVAILABLE_NOW;
  }
  if (
    state === COURT_OPERATIONAL_STATE.OUT_OF_SERVICE_NOW
    || state === "MAINTENANCE"
    || state === "OUT_OF_SERVICE"
  ) {
    return COURT_OPERATIONAL_STATE.OUT_OF_SERVICE_NOW;
  }
  return null;
}

export function normalizeSourceType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (type === RESOURCE_SESSION_SOURCE_TYPE.BOOKING) {
    return RESOURCE_SESSION_SOURCE_TYPE.BOOKING;
  }
  if (type === RESOURCE_SESSION_SOURCE_TYPE.DAILY_PLAY || type === "daily-play") {
    return RESOURCE_SESSION_SOURCE_TYPE.DAILY_PLAY;
  }
  if (type === RESOURCE_SESSION_SOURCE_TYPE.COMPETITION) {
    return RESOURCE_SESSION_SOURCE_TYPE.COMPETITION;
  }
  if (type === RESOURCE_SESSION_SOURCE_TYPE.OPERATIONS) {
    return RESOURCE_SESSION_SOURCE_TYPE.OPERATIONS;
  }
  return null;
}
