/**
 * Canonical Court Operations booking RPC client.
 * Fail closed. No clubStorage / blob / legacy courtId fallback.
 */
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import {
  CANONICAL_BOOKING_CANCEL_RPC,
  CANONICAL_BOOKING_CREATE_RPC,
  CANONICAL_BOOKING_GET_RPC,
  CANONICAL_BOOKING_LIFECYCLE_RPC,
  CANONICAL_BOOKING_LIST_RPC,
  CANONICAL_BOOKING_RESCHEDULE_RPC,
  CANONICAL_BOOKING_TRANSFER_RPC,
} from "../constants/canonicalBooking.js";

let testClientOverride = null;

/** @internal */
export function __setCanonicalBookingRpcClientForTests(client) {
  testClientOverride = client;
}

/** @internal */
export function __resetCanonicalBookingRpcClientForTests() {
  testClientOverride = null;
}

function resolveClient() {
  return testClientOverride || getSupabaseAuthClient();
}

function isMissingRpcError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function")
    || (message.includes("function") && message.includes("does not exist"))
    || error?.code === "PGRST202"
  );
}

function parseRpcJson(data) {
  if (!data) {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: "Canonical booking RPC returned empty.",
    };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, code: COURT_RESOURCE_CODE.OK, ...data };
}

async function callBookingRpc(rpcName, args) {
  if (!testClientOverride && !hasSupabaseConfig()) {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.SUPABASE_NOT_CONFIGURED,
      error: "Supabase is not configured.",
    };
  }
  const client = resolveClient();
  if (!client) {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: "Canonical booking RPC client is unavailable.",
    };
  }
  const { data, error } = await client.rpc(rpcName, args);
  if (error) {
    if (isMissingRpcError(error)) {
      return {
        ok: false,
        code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
        error: error.message,
      };
    }
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      error: error.message,
    };
  }
  return parseRpcJson(data);
}

export async function rpcCreateBooking(input = {}) {
  return callBookingRpc(CANONICAL_BOOKING_CREATE_RPC, {
    p_tenant_id: input.tenantId,
    p_club_id: input.clubId,
    p_physical_court_id: input.physicalCourtId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_request_id: input.requestId,
    p_payload: input.payload ?? {},
  });
}

export async function rpcRescheduleBooking(input = {}) {
  return callBookingRpc(CANONICAL_BOOKING_RESCHEDULE_RPC, {
    p_tenant_id: input.tenantId,
    p_booking_id: input.bookingId,
    p_physical_court_id: input.physicalCourtId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_expected_version: input.expectedVersion,
    p_request_id: input.requestId,
    p_payload: input.payload ?? {},
  });
}

export async function rpcTransferBookingCourt(input = {}) {
  return callBookingRpc(CANONICAL_BOOKING_TRANSFER_RPC, {
    p_tenant_id: input.tenantId,
    p_booking_id: input.bookingId,
    p_new_physical_court_id: input.newPhysicalCourtId,
    p_expected_version: input.expectedVersion,
    p_request_id: input.requestId,
  });
}

export async function rpcCancelBooking(input = {}) {
  return callBookingRpc(CANONICAL_BOOKING_CANCEL_RPC, {
    p_tenant_id: input.tenantId,
    p_booking_id: input.bookingId,
    p_request_id: input.requestId,
    p_release_reason: input.releaseReason ?? "booking_cancelled",
  });
}

export async function rpcUpdateBookingLifecycle(input = {}) {
  return callBookingRpc(CANONICAL_BOOKING_LIFECYCLE_RPC, {
    p_tenant_id: input.tenantId,
    p_booking_id: input.bookingId,
    p_lifecycle_status: input.lifecycleStatus,
    p_expected_version: input.expectedVersion,
    p_request_id: input.requestId,
  });
}

export async function rpcGetBooking(input = {}) {
  return callBookingRpc(CANONICAL_BOOKING_GET_RPC, {
    p_tenant_id: input.tenantId,
    p_booking_id: input.bookingId,
  });
}

export async function rpcListBookings(input = {}) {
  return callBookingRpc(CANONICAL_BOOKING_LIST_RPC, {
    p_tenant_id: input.tenantId,
    p_club_id: input.clubId,
    p_from: input.from ?? null,
    p_to: input.to ?? null,
    p_lifecycle_statuses: input.lifecycleStatuses ?? null,
  });
}
