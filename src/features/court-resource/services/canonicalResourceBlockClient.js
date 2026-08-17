/**
 * Canonical Court Operations resource block RPC client.
 * Fail closed. No clubStorage / blob / legacy courtId fallback.
 */
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import {
  CANONICAL_RESOURCE_BLOCK_CANCEL_RPC,
  CANONICAL_RESOURCE_BLOCK_CREATE_RPC,
  CANONICAL_RESOURCE_BLOCK_GET_RPC,
  CANONICAL_RESOURCE_BLOCK_LIST_RPC,
  CANONICAL_RESOURCE_BLOCK_RESCHEDULE_RPC,
  CANONICAL_RESOURCE_BLOCK_TRANSFER_RPC,
} from "../constants/canonicalResourceBlock.js";

let testClientOverride = null;

/** @internal */
export function __setCanonicalResourceBlockRpcClientForTests(client) {
  testClientOverride = client;
}

/** @internal */
export function __resetCanonicalResourceBlockRpcClientForTests() {
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
      error: "Canonical resource block RPC returned empty.",
    };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, code: COURT_RESOURCE_CODE.OK, ...data };
}

async function callResourceBlockRpc(rpcName, args) {
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
      error: "Canonical resource block RPC client is unavailable.",
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

export async function rpcCreateResourceBlock(input = {}) {
  return callResourceBlockRpc(CANONICAL_RESOURCE_BLOCK_CREATE_RPC, {
    p_tenant_id: input.tenantId,
    p_club_id: input.clubId,
    p_physical_court_id: input.physicalCourtId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_request_id: input.requestId,
    p_payload: input.payload ?? {},
  });
}

export async function rpcRescheduleResourceBlock(input = {}) {
  return callResourceBlockRpc(CANONICAL_RESOURCE_BLOCK_RESCHEDULE_RPC, {
    p_tenant_id: input.tenantId,
    p_resource_block_id: input.resourceBlockId,
    p_physical_court_id: input.physicalCourtId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_expected_version: input.expectedVersion,
    p_request_id: input.requestId,
    p_payload: input.payload ?? {},
  });
}

export async function rpcTransferResourceBlockCourt(input = {}) {
  return callResourceBlockRpc(CANONICAL_RESOURCE_BLOCK_TRANSFER_RPC, {
    p_tenant_id: input.tenantId,
    p_resource_block_id: input.resourceBlockId,
    p_new_physical_court_id: input.newPhysicalCourtId,
    p_expected_version: input.expectedVersion,
    p_request_id: input.requestId,
  });
}

export async function rpcCancelResourceBlock(input = {}) {
  return callResourceBlockRpc(CANONICAL_RESOURCE_BLOCK_CANCEL_RPC, {
    p_tenant_id: input.tenantId,
    p_resource_block_id: input.resourceBlockId,
    p_request_id: input.requestId,
    p_release_reason: input.releaseReason ?? "resource_block_cancelled",
  });
}

export async function rpcGetResourceBlock(input = {}) {
  return callResourceBlockRpc(CANONICAL_RESOURCE_BLOCK_GET_RPC, {
    p_tenant_id: input.tenantId,
    p_resource_block_id: input.resourceBlockId,
  });
}

export async function rpcListResourceBlocks(input = {}) {
  return callResourceBlockRpc(CANONICAL_RESOURCE_BLOCK_LIST_RPC, {
    p_tenant_id: input.tenantId,
    p_club_id: input.clubId,
    p_from: input.from ?? null,
    p_to: input.to ?? null,
    p_physical_court_ids: input.physicalCourtIds ?? null,
    p_block_types: input.blockTypes ?? null,
    p_include_cancelled: input.includeCancelled === true,
  });
}
