/**
 * Canonical reservation RPC client.
 * Default path is fail-closed. No silent legacy authority fallback.
 */
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import {
  CANONICAL_AVAILABILITY_RPC,
  CANONICAL_RELEASE_RPC,
  CANONICAL_RESERVE_RPC,
} from "../constants/canonicalReservation.js";

let testClientOverride = null;

/** @internal */
export function __setCanonicalReservationRpcClientForTests(client) {
  testClientOverride = client;
}

/** @internal */
export function __resetCanonicalReservationRpcClientForTests() {
  testClientOverride = null;
}

function resolveClient() {
  return testClientOverride || getSupabaseAuthClient();
}

function isMissingRpcError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist")) ||
    error?.code === "PGRST202"
  );
}

function parseRpcJson(data) {
  if (!data) {
    return {
      ok: false,
      code: COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: "Canonical reservation RPC returned empty.",
    };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, code: COURT_RESOURCE_CODE.OK, ...data };
}

async function callCanonicalRpc(rpcName, args) {
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
      error: "Canonical reservation RPC client is unavailable.",
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

export async function rpcReserveCourts(input = {}) {
  return callCanonicalRpc(CANONICAL_RESERVE_RPC, {
    p_tenant_id: input.tenantId,
    p_club_id: input.clubId,
    p_physical_court_ids: input.physicalCourtIds,
    p_owner_type: input.ownerType,
    p_owner_id: input.ownerId,
    p_owner_sub_type: input.ownerSubType ?? null,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_request_id: input.requestId,
  });
}

export async function rpcReleaseCourts(input = {}) {
  return callCanonicalRpc(CANONICAL_RELEASE_RPC, {
    p_tenant_id: input.tenantId,
    p_reservation_ids: input.reservationIds ?? null,
    p_owner_type: input.ownerType,
    p_owner_id: input.ownerId,
    p_physical_court_ids: input.physicalCourtIds ?? null,
    p_request_id: input.requestId,
    p_release_reason: input.releaseReason ?? null,
  });
}

export async function rpcGetAvailability(input = {}) {
  return callCanonicalRpc(CANONICAL_AVAILABILITY_RPC, {
    p_tenant_id: input.tenantId,
    p_club_id: input.clubId,
    p_physical_court_ids: input.physicalCourtIds,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_owner_type: input.ownerType ?? null,
    p_owner_id: input.ownerId ?? null,
  });
}
