/**
 * Court Operations — canonical Booking business lifecycle contract.
 * Capacity SSOT remains court_resource_reservations (via CourtResourceGateway / Phase 3B).
 * Booking business SSOT is court_operations_bookings (this package).
 *
 * Cutover default OFF — not activated in Staging/Production during Batch 3.
 */
export const CANONICAL_BOOKING_CONTRACT_VERSION =
  "court-operations.canonical-booking-lifecycle.v1";

export const CANONICAL_BOOKING_TABLE = "court_operations_bookings";
export const CANONICAL_BOOKING_COMMAND_LEDGER =
  "court_operations_booking_commands";

export const CANONICAL_BOOKING_CREATE_RPC = "court_operations_booking_create";
export const CANONICAL_BOOKING_RESCHEDULE_RPC =
  "court_operations_booking_reschedule";
export const CANONICAL_BOOKING_TRANSFER_RPC =
  "court_operations_booking_transfer_court";
export const CANONICAL_BOOKING_CANCEL_RPC = "court_operations_booking_cancel";
export const CANONICAL_BOOKING_LIFECYCLE_RPC =
  "court_operations_booking_update_lifecycle";
export const CANONICAL_BOOKING_GET_RPC = "court_operations_booking_get";
export const CANONICAL_BOOKING_LIST_RPC = "court_operations_booking_list";

export const CANONICAL_BOOKING_OWNER_TYPE = "booking";

export const CANONICAL_BOOKING_LIFECYCLE_STATUS = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  PLAYING: "playing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
});

import {
  COURT_CANONICAL_VITE_FLAGS,
  readCourtCanonicalViteFlag,
} from "./courtCanonicalViteFlags.js";

/** Global adoption control — OFF until Staging acceptance. */
export const CANONICAL_BOOKING_LIFECYCLE_DEFAULT = false;

let lifecycleOverride = null;

export function isCanonicalBookingLifecycle() {
  if (lifecycleOverride === true) return true;
  if (lifecycleOverride === false) return false;
  if (readCourtCanonicalViteFlag(COURT_CANONICAL_VITE_FLAGS.BOOKING_LIFECYCLE)) {
    return true;
  }
  return CANONICAL_BOOKING_LIFECYCLE_DEFAULT;
}

/** @internal */
export function __setCanonicalBookingLifecycleForTests(enabled) {
  lifecycleOverride = enabled === true;
}

/** @internal */
export function __resetCanonicalBookingLifecycleForTests() {
  lifecycleOverride = null;
}
