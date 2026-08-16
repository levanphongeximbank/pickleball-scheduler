/**
 * Court Resource Phase 3B — canonical reservation contract.
 * Durable capacity authority is public.court_resource_reservations.
 * Court Engine must not insert rows into that table.
 */
export const CANONICAL_RESERVATION_CONTRACT_VERSION =
  "court-resource.canonical-reservation.v1";

export const CANONICAL_RESERVATION_TABLE = "court_resource_reservations";
export const CANONICAL_RESERVATION_COMMAND_LEDGER =
  "court_resource_reservation_commands";
export const CANONICAL_RESERVATION_CUTOVER_TABLE =
  "court_resource_reservation_cutover";

export const CANONICAL_RESERVE_RPC = "court_resource_reserve";
export const CANONICAL_RELEASE_RPC = "court_resource_release";
export const CANONICAL_AVAILABILITY_RPC = "court_resource_get_availability";
export const CANONICAL_LIST_OWNER_RESERVATIONS_RPC =
  "court_resource_list_owner_reservations";

export const CANONICAL_OWNER_TYPE = Object.freeze({
  BOOKING: "booking",
  COMPETITION: "competition",
  DAILY_PLAY: "daily_play",
  MAINTENANCE: "maintenance",
  OPERATIONS: "operations",
});

export const CANONICAL_RESERVATION_STATUS = Object.freeze({
  ACTIVE: "active",
  RELEASED: "released",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
});

export const CANONICAL_AVAILABILITY_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  OWN_RESERVATION: "OWN_RESERVATION",
  FOREIGN_RESERVATION: "FOREIGN_RESERVATION",
  MAINTENANCE: "MAINTENANCE",
  OUT_OF_SCOPE: "OUT_OF_SCOPE",
  UNKNOWN_COURT: "UNKNOWN_COURT",
});

export const CANONICAL_DERIVED_STATUS = Object.freeze({
  LIVE_OCCUPANCY: "LIVE_OCCUPANCY",
  OPERATIONAL_BLOCK: "OPERATIONAL_BLOCK",
});

import {
  COURT_CANONICAL_VITE_FLAGS,
  readCourtCanonicalViteFlag,
} from "./courtCanonicalViteFlags.js";

export const CANONICAL_RESERVATION_CUTOVER_DEFAULT = false;

let cutoverOverride = null;

export function isCanonicalReservationCutover() {
  if (cutoverOverride === true) return true;
  if (cutoverOverride === false) return false;
  if (readCourtCanonicalViteFlag(COURT_CANONICAL_VITE_FLAGS.RESERVATION_CUTOVER)) {
    return true;
  }
  return CANONICAL_RESERVATION_CUTOVER_DEFAULT;
}

/** @internal */
export function __setCanonicalReservationCutoverForTests(enabled) {
  cutoverOverride = enabled === true;
}

/** @internal */
export function __resetCanonicalReservationCutoverForTests() {
  cutoverOverride = null;
}

export function mapGatewayOwnerTypeToCanonical(ownerType) {
  const type = String(ownerType || "").trim().toLowerCase();
  if (type === "tournament" || type === "competition") {
    return CANONICAL_OWNER_TYPE.COMPETITION;
  }
  if (type === "customer" || type === "booking") {
    return CANONICAL_OWNER_TYPE.BOOKING;
  }
  if (type === "daily_play" || type === "dailyplay" || type === "social_play") {
    return CANONICAL_OWNER_TYPE.DAILY_PLAY;
  }
  if (type === "maintenance") return CANONICAL_OWNER_TYPE.MAINTENANCE;
  if (type === "operations") return CANONICAL_OWNER_TYPE.OPERATIONS;
  return null;
}
