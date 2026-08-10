/**
 * Narrow Operation B1B live adapters.
 * Auth ban/unban + controlled quarantine RPCs only.
 * No raw admin/client/from exposure.
 * No deleteUser / createUser / arbitrary updateUserById / updateProfileStatus.
 * No direct qa_identity_quarantines DML.
 */

import {
  AUTH_UNBAN_DURATION,
  QUARANTINE_BAN_DURATION,
} from "./constants.js";

/** Approved public capability names only — frozen adapter surface. */
export const OPERATION_B1B_LIVE_ADAPTER_CAPABILITIES = Object.freeze([
  "fetchAuthUser",
  "fetchProfile",
  "fetchAuthBanState",
  "fetchReferenceCounts",
  "validateQaPrepareContract",
  "qaQuarantinePrepare",
  "qaQuarantineActivateAfterAuthBan",
  "qaQuarantineActivatePreexistingBan",
  "qaQuarantineRecordCompensatedFailure",
  "qaQuarantineRelease",
  "qaQuarantineGetState",
  "banAuthUser",
  "unbanAuthUser",
]);

/**
 * Exact PostgREST/RPC argument keys locked to WP2 SQL signatures.
 * Tests must assert these exact key sets.
 */
export const OPERATION_B1B_RPC_ARG_KEYS = Object.freeze({
  operation_b1b_validate_qa_prepare_contract: Object.freeze(["p_bindings"]),
  qa_quarantine_prepare: Object.freeze([
    "p_profile_id",
    "p_auth_user_id",
    "p_batch_id",
    "p_allowlist_sha256",
    "p_snapshot_sha256",
    "p_reason",
    "p_original_profile_status",
    "p_original_auth_banned",
    "p_expected_email",
    "p_allowlist_label",
    "p_metadata",
  ]),
  qa_quarantine_activate_after_auth_ban: Object.freeze([
    "p_quarantine_id",
    "p_expected_lifecycle_version",
    "p_auth_ban_readback_confirmed",
  ]),
  qa_quarantine_activate_preexisting_ban: Object.freeze([
    "p_quarantine_id",
    "p_expected_lifecycle_version",
  ]),
  qa_quarantine_record_compensated_failure: Object.freeze([
    "p_quarantine_id",
    "p_expected_lifecycle_version",
    "p_target_auth_ban_state",
    "p_failure_classification",
  ]),
  qa_quarantine_release: Object.freeze([
    "p_quarantine_id",
    "p_expected_lifecycle_version",
    "p_release_reason",
  ]),
  qa_quarantine_get_state: Object.freeze(["p_quarantine_id"]),
});

const FORBIDDEN_SURFACE_KEYS = Object.freeze([
  "admin",
  "client",
  "supabase",
  "from",
  "rpc",
  "auth",
  "deleteUser",
  "createUser",
  "updateUserById",
  "updateProfileStatus",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeReason(err) {
  const msg = String(err?.message || err?.reason || err || "unknown_error");
  return msg.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]");
}

function assertExactRpcArgs(rpcName, args) {
  const expected = OPERATION_B1B_RPC_ARG_KEYS[rpcName];
  if (!expected) {
    throw new Error(`unknown_rpc_contract:${rpcName}`);
  }
  const keys = Object.keys(args || {}).sort();
  const want = [...expected].sort();
  if (keys.length !== want.length || keys.some((k, i) => k !== want[i])) {
    return {
      ok: false,
      reason: `rpc_arg_keys_mismatch:${rpcName}`,
      code: "rpc_arg_keys_mismatch",
      expected: want,
      actual: keys,
    };
  }
  return { ok: true };
}

async function countExact(client, table, filters = []) {
  let q = client.from(table).select("*", { count: "exact", head: true });
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val);
  }
  const { count, error } = await q;
  if (error) throw error;
  return Number(count || 0);
}

async function callRpc(admin, name, args) {
  const keyCheck = assertExactRpcArgs(name, args);
  if (!keyCheck.ok) return keyCheck;
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    return { ok: false, reason: sanitizeReason(error), code: error.code || null };
  }
  if (data && typeof data === "object" && data.ok === false) {
    return {
      ok: false,
      reason: data.code || data.reason || "rpc_rejected",
      code: data.code || null,
      data,
    };
  }
  return { ok: true, data };
}

/**
 * Resolve createClient from injected impl or already-installed @supabase/supabase-js.
 */
export async function resolveSupabaseCreateClient(createClientImpl) {
  if (typeof createClientImpl === "function") return createClientImpl;
  const mod = await import("@supabase/supabase-js");
  return mod.createClient;
}

export async function createOperationB1BAdminClient(opts) {
  const create = await resolveSupabaseCreateClient(opts.createClientImpl);
  return create(opts.url, opts.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Build package-compatible adapters. Mutation writers require a real admin client
 * held in closure only — never returned as `admin` / `client` / `supabase`.
 * @param {{ admin: any }} input
 */
export function createOperationB1BLiveAdapters({ admin }) {
  if (!admin) {
    throw new Error("admin_client_required");
  }

  async function fetchAuthUser(userId) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data?.user) return null;
      const user = data.user;
      return {
        id: user.id,
        email: user.email || null,
        banned_until: user.banned_until || null,
      };
    } catch {
      return null;
    }
  }

  async function fetchProfile(profileId) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,email,status")
      .eq("id", profileId)
      .maybeSingle();
    if (error) return null;
    return data || null;
  }

  async function fetchAuthBanState(userId) {
    const user = await fetchAuthUser(userId);
    if (!user) return null;
    const bannedUntil = user.banned_until;
    if (!bannedUntil) return false;
    return new Date(bannedUntil).getTime() > Date.now();
  }

  async function fetchReferenceCounts(profileId) {
    const id = profileId;
    const athlete_count = await countExact(admin, "athletes", [
      { op: "eq", col: "user_id", val: id },
    ]);
    const membership_active = await countExact(admin, "club_members", [
      { op: "eq", col: "user_id", val: id },
      { op: "eq", col: "status", val: "active" },
    ]);
    const membership_removed = await countExact(admin, "club_members", [
      { op: "eq", col: "user_id", val: id },
      { op: "eq", col: "status", val: "removed" },
    ]);
    const membership_total = await countExact(admin, "club_members", [
      { op: "eq", col: "user_id", val: id },
    ]);
    const tenant_members = await countExact(admin, "tenant_members", [
      { op: "eq", col: "user_id", val: id },
    ]);
    const tenants_owned = await countExact(admin, "tenants", [
      { op: "eq", col: "owner_user_id", val: id },
    ]);
    const club_governance_owner = await countExact(admin, "clubs", [
      { op: "eq", col: "created_by_user_id", val: id },
    ]);
    return {
      athlete_count,
      membership_active,
      membership_removed,
      membership_total,
      tenant_members,
      tenants_owned,
      club_governance_owner,
      tournament_refs: 0,
      rating_refs: 0,
      finance_refs: 0,
      other_business_refs: 0,
    };
  }

  async function validateQaPrepareContract(args) {
    const bindings = Array.isArray(args?.bindings) ? args.bindings : null;
    if (!bindings) {
      return {
        ok: false,
        reason: "bindings_required",
        code: "bindings_required",
      };
    }
    return callRpc(admin, "operation_b1b_validate_qa_prepare_contract", {
      p_bindings: bindings,
    });
  }

  async function qaQuarantinePrepare(args) {
    return callRpc(admin, "qa_quarantine_prepare", {
      p_profile_id: args.profileId,
      p_auth_user_id: args.authUserId,
      p_batch_id: args.batchId,
      p_allowlist_sha256: args.allowlistSha256,
      p_snapshot_sha256: args.snapshotSha256,
      p_reason: args.reason,
      p_original_profile_status: args.originalProfileStatus,
      p_original_auth_banned: args.originalAuthBanned,
      p_expected_email: args.expectedEmail,
      p_allowlist_label: args.allowlistLabel,
      p_metadata: args.metadata ?? {},
    });
  }

  async function qaQuarantineActivateAfterAuthBan(args) {
    return callRpc(admin, "qa_quarantine_activate_after_auth_ban", {
      p_quarantine_id: args.quarantineId,
      p_expected_lifecycle_version: args.expectedLifecycleVersion,
      p_auth_ban_readback_confirmed: args.authBanReadbackConfirmed === true,
    });
  }

  async function qaQuarantineActivatePreexistingBan(args) {
    return callRpc(admin, "qa_quarantine_activate_preexisting_ban", {
      p_quarantine_id: args.quarantineId,
      p_expected_lifecycle_version: args.expectedLifecycleVersion,
    });
  }

  async function qaQuarantineRecordCompensatedFailure(args) {
    return callRpc(admin, "qa_quarantine_record_compensated_failure", {
      p_quarantine_id: args.quarantineId,
      p_expected_lifecycle_version: args.expectedLifecycleVersion,
      p_target_auth_ban_state: args.targetAuthBanState,
      p_failure_classification: args.failureClassification,
    });
  }

  async function qaQuarantineRelease(args) {
    return callRpc(admin, "qa_quarantine_release", {
      p_quarantine_id: args.quarantineId,
      p_expected_lifecycle_version: args.expectedLifecycleVersion,
      p_release_reason: args.releaseReason,
    });
  }

  async function qaQuarantineGetState(args) {
    const quarantineId = String(args?.quarantineId || "").trim();
    if (!UUID_RE.test(quarantineId)) {
      return {
        ok: false,
        reason: "invalid_or_missing_quarantine_id",
        code: "invalid_input",
      };
    }
    // WP2 signature: qa_quarantine_get_state(p_quarantine_id uuid) ONLY.
    return callRpc(admin, "qa_quarantine_get_state", {
      p_quarantine_id: quarantineId,
    });
  }

  async function banAuthUser({ userId, banDuration, reason }) {
    try {
      const duration = banDuration || QUARANTINE_BAN_DURATION;
      if (duration !== QUARANTINE_BAN_DURATION) {
        return { ok: false, reason: "unapproved_ban_duration" };
      }
      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: duration,
      });
      if (error) return { ok: false, reason: sanitizeReason(error) };
      const bannedUntil = data?.user?.banned_until;
      const banned =
        bannedUntil && new Date(bannedUntil).getTime() > Date.now();
      if (!banned) {
        return { ok: false, reason: "auth_ban_verify_failed" };
      }
      return { ok: true, reason: reason || null };
    } catch (err) {
      return { ok: false, reason: sanitizeReason(err) };
    }
  }

  async function unbanAuthUser({ userId }) {
    try {
      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: AUTH_UNBAN_DURATION,
      });
      if (error) return { ok: false, reason: sanitizeReason(error) };
      const bannedUntil = data?.user?.banned_until;
      const stillBanned =
        bannedUntil && new Date(bannedUntil).getTime() > Date.now();
      if (stillBanned) {
        return { ok: false, reason: "auth_unban_verify_failed" };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: sanitizeReason(err) };
    }
  }

  const adapters = {
    fetchAuthUser,
    fetchProfile,
    fetchAuthBanState,
    fetchReferenceCounts,
    validateQaPrepareContract,
    qaQuarantinePrepare,
    qaQuarantineActivateAfterAuthBan,
    qaQuarantineActivatePreexistingBan,
    qaQuarantineRecordCompensatedFailure,
    qaQuarantineRelease,
    qaQuarantineGetState,
    banAuthUser,
    unbanAuthUser,
  };

  for (const key of FORBIDDEN_SURFACE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(adapters, key)) {
      throw new Error(`forbidden_adapter_surface:${key}`);
    }
  }

  return Object.freeze(adapters);
}

export function assertNarrowAdapterSurface(adapters) {
  const keys = Object.keys(adapters || {}).sort();
  const expected = [...OPERATION_B1B_LIVE_ADAPTER_CAPABILITIES].sort();
  const extra = keys.filter((k) => !expected.includes(k));
  const forbidden = keys.filter((k) => FORBIDDEN_SURFACE_KEYS.includes(k));
  return {
    ok: forbidden.length === 0 && !keys.includes("updateProfileStatus"),
    keys,
    expected,
    extra,
    forbidden,
    hasUpdateProfileStatus: keys.includes("updateProfileStatus"),
    hasHardDelete:
      keys.includes("deleteUser") || keys.includes("hardDelete"),
  };
}
