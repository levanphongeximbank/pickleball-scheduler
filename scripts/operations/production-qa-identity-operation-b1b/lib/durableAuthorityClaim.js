/**
 * Durable one-time live execution authority claim for OPERATION B1B.
 *
 * Process-local Set is NOT durable. This module implements / adapts the
 * injected claimOneTimeLiveAuthority(bind) dependency required by
 * presentLiveAuthority / runB1BExecute.
 *
 * Never persists OWNER_*_GO plaintext, DB URLs, tokens, JWTs, or service keys.
 * Stores owner_go_fingerprint = sha256 only.
 */

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  EXPECTED_STAGING_PROJECT_REF,
  OPERATION_ID,
  OPERATION_TARGET_MODE,
} from "./constants.js";
import { sha256Hex } from "./allowlist.js";

export const DURABLE_AUTHORITY_CLAIM_RPC =
  "operation_b1b_claim_one_time_live_authority";

export const DURABLE_AUTHORITY_CLAIM_READBACK_RPC =
  "operation_b1b_get_one_time_live_authority_claim";

export const OPERATION_B1B_DURABLE_CLAIM_RPC_ARG_KEYS = Object.freeze({
  [DURABLE_AUTHORITY_CLAIM_RPC]: Object.freeze([
    "p_operation_id",
    "p_operation_target_mode",
    "p_project_ref",
    "p_batch_id",
    "p_allowlist_sha256",
    "p_snapshot_sha256",
    "p_exact_eight_uuid_set_hash",
    "p_execution_version",
    "p_owner_go_fingerprint",
  ]),
  [DURABLE_AUTHORITY_CLAIM_READBACK_RPC]: Object.freeze([
    "p_operation_id",
    "p_operation_target_mode",
    "p_project_ref",
    "p_batch_id",
  ]),
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/;

const OWNER_GO_FINGERPRINT_PREFIX = "operation-b1b-owner-go-v1:";

/**
 * Safe fingerprint of Owner GO — never store plaintext GO.
 * @param {string} ownerGo
 */
export function fingerprintOwnerGo(ownerGo) {
  return sha256Hex(`${OWNER_GO_FINGERPRINT_PREFIX}${String(ownerGo || "").trim()}`);
}

/**
 * Canonical hash of the exact-eight UUID set (profile_id + auth_user_id pairs).
 * @param {Array<{ profile_id?: string, auth_user_id?: string }>} identities
 */
export function hashExactEightUuidSet(identities) {
  const list = Array.isArray(identities) ? identities : [];
  const pairs = list
    .map((row) => {
      const profileId = String(row?.profile_id || "")
        .trim()
        .toLowerCase();
      const authUserId = String(row?.auth_user_id || "")
        .trim()
        .toLowerCase();
      return `${profileId}:${authUserId}`;
    })
    .sort();
  return sha256Hex(pairs.join("|"));
}

function normalizeHex64(value, field) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (!HEX64_RE.test(v)) {
    return { ok: false, reason: `invalid_or_missing_${field}` };
  }
  return { ok: true, value: v };
}

/**
 * Validate bind shape before durable claim consumption.
 * Rejects missing hashes / wrong project binding; does not mutate stores.
 */
export function validateDurableAuthorityBind(bind = {}) {
  const reasons = [];
  const operationId = String(bind.operationId || "").trim();
  const mode = String(bind.operationTargetMode || "")
    .trim()
    .toLowerCase();
  const batchId = String(bind.batchId || "")
    .trim()
    .toLowerCase();
  const isStaging = mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL;
  const projectRef = String(
    isStaging
      ? bind.stagingProjectRef || bind.projectRef || ""
      : bind.productionProjectRef || bind.projectRef || ""
  ).trim();

  if (operationId !== OPERATION_ID) {
    reasons.push("invalid_operation_id");
  }
  if (
    mode !== OPERATION_TARGET_MODE.STAGING_REHEARSAL &&
    mode !== OPERATION_TARGET_MODE.PRODUCTION
  ) {
    reasons.push("invalid_operation_target_mode");
  }
  if (!UUID_RE.test(batchId)) {
    reasons.push("malformed_or_missing_batch_id");
  }

  if (isStaging) {
    if (projectRef === EXPECTED_PRODUCTION_PROJECT_REF) {
      reasons.push("production_project_ref_rejected_in_staging_mode");
    } else if (projectRef !== EXPECTED_STAGING_PROJECT_REF) {
      reasons.push("wrong_or_missing_staging_project_ref");
    }
  } else if (mode === OPERATION_TARGET_MODE.PRODUCTION) {
    if (projectRef === EXPECTED_STAGING_PROJECT_REF) {
      reasons.push("staging_project_ref_rejected_in_production_mode");
    } else if (projectRef !== EXPECTED_PRODUCTION_PROJECT_REF) {
      reasons.push("wrong_or_missing_production_project_ref");
    }
  }

  const allow = normalizeHex64(bind.allowlistSha256, "allowlist_sha256");
  if (!allow.ok) reasons.push(allow.reason);
  const snap = normalizeHex64(bind.snapshotSha256, "snapshot_sha256");
  if (!snap.ok) reasons.push(snap.reason);
  const eight = normalizeHex64(
    bind.exactEightUuidSetHash,
    "exact_eight_uuid_set_hash"
  );
  if (!eight.ok) reasons.push(eight.reason);

  const ownerGo = isStaging
    ? String(bind.ownerStagingGo || "").trim()
    : String(bind.ownerProductionGo || "").trim();
  if (!ownerGo) {
    reasons.push(
      isStaging
        ? "missing_fresh_owner_staging_go"
        : "missing_fresh_owner_production_go"
    );
  }

  // Never accept an already-hex fingerprint field that looks like a raw GO.
  if (/^APPROVE_/i.test(String(bind.ownerGoFingerprint || "").trim())) {
    reasons.push("owner_go_plaintext_or_secret_rejected");
  }

  if (reasons.length) {
    return { ok: false, reasons, consumed: false };
  }

  const fingerprint = fingerprintOwnerGo(ownerGo);
  const executionVersion =
    bind.executionVersion == null || String(bind.executionVersion).trim() === ""
      ? null
      : String(bind.executionVersion).trim().slice(0, 128);

  return {
    ok: true,
    reasons: [],
    consumed: false,
    normalized: Object.freeze({
      operationId: OPERATION_ID,
      operationTargetMode: mode,
      projectRef,
      batchId,
      allowlistSha256: allow.value,
      snapshotSha256: snap.value,
      exactEightUuidSetHash: eight.value,
      executionVersion,
      ownerGoFingerprint: fingerprint,
    }),
  };
}

function mapClaimRpcResult(data) {
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      consumed: false,
      reason: "durable_authority_claim_empty_result",
    };
  }
  if (data.ok === true) {
    return {
      ok: true,
      consumed: true,
      durable: true,
      reason: data.reason || "CLAIMED",
      claimId: data.claim_id || null,
      claimedAt: data.claimed_at || null,
      status: data.status || "consumed",
    };
  }
  const reason =
    data.reason === "REJECTED_ALREADY_CLAIMED" ||
    data.code === "authority_already_consumed"
      ? "authority_already_consumed"
      : data.reason || data.code || "durable_authority_claim_rejected";
  return {
    ok: false,
    consumed: Boolean(data.consumed),
    reason,
    claimId: data.claim_id || null,
    claimedAt: data.claimed_at || null,
    status: data.status || null,
  };
}

/**
 * Create claimOneTimeLiveAuthority via Supabase admin.rpc (service role).
 * @param {{ admin: { rpc: Function } }} opts
 */
export function createOperationB1BDurableAuthorityClaimer({ admin } = {}) {
  if (!admin || typeof admin.rpc !== "function") {
    throw new Error("admin_rpc_client_required_for_durable_authority_claim");
  }

  return async function claimOneTimeLiveAuthority(bind) {
    const validated = validateDurableAuthorityBind(bind);
    if (!validated.ok) {
      return {
        ok: false,
        consumed: false,
        reason: validated.reasons[0] || "invalid_durable_authority_bind",
        reasons: validated.reasons,
      };
    }
    const n = validated.normalized;
    const args = {
      p_operation_id: n.operationId,
      p_operation_target_mode: n.operationTargetMode,
      p_project_ref: n.projectRef,
      p_batch_id: n.batchId,
      p_allowlist_sha256: n.allowlistSha256,
      p_snapshot_sha256: n.snapshotSha256,
      p_exact_eight_uuid_set_hash: n.exactEightUuidSetHash,
      p_execution_version: n.executionVersion,
      p_owner_go_fingerprint: n.ownerGoFingerprint,
    };
    const { data, error } = await admin.rpc(DURABLE_AUTHORITY_CLAIM_RPC, args);
    if (error) {
      return {
        ok: false,
        consumed: false,
        reason: `durable_authority_claim_rpc_error:${String(error.message || error)}`,
      };
    }
    return mapClaimRpcResult(data);
  };
}

/**
 * Create claimOneTimeLiveAuthority via node-pg client (local/real Postgres tests).
 * Caller must establish service_role JWT claim / SET ROLE before invoke.
 * @param {{ client: { query: Function }, asServiceRole?: Function }} opts
 */
export function createPgOperationB1BDurableAuthorityClaimer({
  client,
  asServiceRole,
} = {}) {
  if (!client || typeof client.query !== "function") {
    throw new Error("pg_client_required_for_durable_authority_claim");
  }

  return async function claimOneTimeLiveAuthority(bind) {
    const validated = validateDurableAuthorityBind(bind);
    if (!validated.ok) {
      return {
        ok: false,
        consumed: false,
        reason: validated.reasons[0] || "invalid_durable_authority_bind",
        reasons: validated.reasons,
      };
    }
    const n = validated.normalized;
    if (typeof asServiceRole === "function") {
      await asServiceRole();
    }
    const { rows } = await client.query(
      `SELECT public.operation_b1b_claim_one_time_live_authority(
         $1::text, $2::text, $3::text, $4::uuid,
         $5::text, $6::text, $7::text, $8::text, $9::text
       ) AS result`,
      [
        n.operationId,
        n.operationTargetMode,
        n.projectRef,
        n.batchId,
        n.allowlistSha256,
        n.snapshotSha256,
        n.exactEightUuidSetHash,
        n.executionVersion,
        n.ownerGoFingerprint,
      ]
    );
    return mapClaimRpcResult(rows[0]?.result);
  };
}

/**
 * Readback helper for evidence packages (no secrets).
 */
export async function readPgDurableAuthorityClaim(
  client,
  {
    operationId = OPERATION_ID,
    operationTargetMode,
    projectRef,
    batchId,
  },
  { asServiceRole } = {}
) {
  if (typeof asServiceRole === "function") {
    await asServiceRole();
  }
  const { rows } = await client.query(
    `SELECT public.operation_b1b_get_one_time_live_authority_claim(
       $1::text, $2::text, $3::text, $4::uuid
     ) AS result`,
    [operationId, operationTargetMode, projectRef, batchId]
  );
  return rows[0]?.result ?? null;
}

/**
 * Scan a claim row / evidence object for forbidden secret material.
 * Allows fingerprint hex and claimed_by role labels; rejects raw GO / URLs / JWTs.
 * @param {unknown} value
 */
export function assertNoSecretsInClaimEvidence(value) {
  const text = JSON.stringify(value ?? {});
  if (/APPROVE_OPERATION_B1/i.test(text)) {
    return { ok: false, reason: "secret_or_go_plaintext_detected:owner_go" };
  }
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text)) {
    return { ok: false, reason: "secret_or_go_plaintext_detected:jwt" };
  }
  if (/postgres(ql)?:\/\/[^"\s]+/i.test(text)) {
    return { ok: false, reason: "secret_or_go_plaintext_detected:db_url" };
  }
  if (/"ownerStagingGo"\s*:\s*"[^"]+"/i.test(text)) {
    return { ok: false, reason: "secret_or_go_plaintext_detected:owner_staging_go" };
  }
  if (/"ownerProductionGo"\s*:\s*"[^"]+"/i.test(text)) {
    return { ok: false, reason: "secret_or_go_plaintext_detected:owner_production_go" };
  }
  return { ok: true };
}
