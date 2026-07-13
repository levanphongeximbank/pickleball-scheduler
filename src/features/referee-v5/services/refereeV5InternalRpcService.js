import { REFEREE_V5_ERROR, createPersistenceError } from "../persistence/errors.js";

let internalRpcClientOverride = null;
let allowInternalRpcInTests = false;

/** Internal RPCs — service role only. Must never be exposed to browser client. */
export const REFEREE_V5_INTERNAL_RPC_NAMES = Object.freeze({
  COMMIT_MATCH_TRANSITION: "referee_v5_commit_match_transition",
  COMMIT_MATCH_FINALIZATION: "referee_v5_commit_match_finalization",
});

export function setRefereeV5InternalRpcClientForTests(client, allow = true) {
  internalRpcClientOverride = client;
  allowInternalRpcInTests = allow;
}

export function assertInternalRpcAllowed() {
  if (typeof window !== "undefined" && !allowInternalRpcInTests) {
    return createPersistenceError(
      REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN,
      "Internal commit RPC không khả dụng từ browser."
    );
  }
  return { ok: true };
}

function getInternalClient() {
  const guard = assertInternalRpcAllowed();
  if (!guard.ok) {
    throw new Error(guard.error);
  }
  if (!internalRpcClientOverride) {
    throw new Error("Internal RPC client chưa cấu hình (service role only).");
  }
  return internalRpcClientOverride;
}

export async function refereeV5CommitMatchTransition(payload) {
  const guard = assertInternalRpcAllowed();
  if (!guard.ok) {
    return guard;
  }
  const client = getInternalClient();
  const { data, error } = await client.rpc(
    REFEREE_V5_INTERNAL_RPC_NAMES.COMMIT_MATCH_TRANSITION,
    payload
  );
  if (error) {
    return { ok: false, code: REFEREE_V5_ERROR.VALIDATION_FAILED, error: error.message };
  }
  return data?.ok === false ? data : { ok: true, ...data };
}

export async function refereeV5CommitMatchFinalization(payload) {
  const guard = assertInternalRpcAllowed();
  if (!guard.ok) {
    return guard;
  }
  const client = getInternalClient();
  const { data, error } = await client.rpc(
    REFEREE_V5_INTERNAL_RPC_NAMES.COMMIT_MATCH_FINALIZATION,
    payload
  );
  if (error) {
    return { ok: false, code: REFEREE_V5_ERROR.VALIDATION_FAILED, error: error.message };
  }
  return data?.ok === false ? data : { ok: true, ...data };
}

export function isPublicBrowserRpc(rpcName) {
  return !Object.values(REFEREE_V5_INTERNAL_RPC_NAMES).includes(rpcName);
}
