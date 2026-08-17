/**
 * Canonical Court Live Resource Runtime RPC client.
 * Fail closed. No clubStorage / blob / match lifecycle / reservation writes.
 */
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import {
  CANONICAL_LIVE_BEGIN_SESSION_RPC,
  CANONICAL_LIVE_END_SESSION_RPC,
  CANONICAL_LIVE_GET_STATE_RPC,
  CANONICAL_LIVE_LIST_SESSIONS_RPC,
  CANONICAL_LIVE_SET_OPERATIONAL_STATE_RPC,
} from "../constants/canonicalLiveRuntime.js";

let testClientOverride = null;

/** @internal */
export function __setCanonicalLiveRuntimeRpcClientForTests(client) {
  testClientOverride = client;
}

/** @internal */
export function __resetCanonicalLiveRuntimeRpcClientForTests() {
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
      error: "Canonical live runtime RPC returned empty.",
    };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, code: COURT_RESOURCE_CODE.OK, ...data };
}

async function callLiveRuntimeRpc(rpcName, args) {
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
      error: "Canonical live runtime RPC client is unavailable.",
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
      code: error.code || COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      error: error.message,
    };
  }
  return parseRpcJson(data);
}

export async function rpcBeginResourceSession(input = {}) {
  return callLiveRuntimeRpc(CANONICAL_LIVE_BEGIN_SESSION_RPC, {
    p_tenant_id: input.tenantId,
    p_physical_court_id: input.physicalCourtId,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_reservation_ref: input.reservationRef || null,
    p_request_id: input.requestId,
    p_actor_id: input.actorId || null,
    p_operations_authorized: input.operationsAuthorized === true,
    p_capacity_claim_valid: input.capacityClaimValid === true,
  });
}

export async function rpcEndResourceSession(input = {}) {
  return callLiveRuntimeRpc(CANONICAL_LIVE_END_SESSION_RPC, {
    p_tenant_id: input.tenantId,
    p_physical_court_id: input.physicalCourtId || null,
    p_resource_session_id: input.resourceSessionId || null,
    p_source_type: input.sourceType || null,
    p_source_id: input.sourceId || null,
    p_request_id: input.requestId,
    p_actor_id: input.actorId || null,
  });
}

export async function rpcSetCurrentOperationalState(input = {}) {
  return callLiveRuntimeRpc(CANONICAL_LIVE_SET_OPERATIONAL_STATE_RPC, {
    p_tenant_id: input.tenantId,
    p_physical_court_id: input.physicalCourtId,
    p_operational_state: input.operationalState || input.state,
    p_reason: input.reason || "",
    p_request_id: input.requestId,
    p_actor_id: input.actorId || null,
  });
}

export async function rpcGetCourtLiveState(input = {}) {
  return callLiveRuntimeRpc(CANONICAL_LIVE_GET_STATE_RPC, {
    p_tenant_id: input.tenantId,
    p_physical_court_id: input.physicalCourtId,
  });
}

export async function rpcListResourceSessions(input = {}) {
  return callLiveRuntimeRpc(CANONICAL_LIVE_LIST_SESSIONS_RPC, {
    p_tenant_id: input.tenantId,
    p_physical_court_id: input.physicalCourtId || null,
    p_status: input.status || null,
  });
}
