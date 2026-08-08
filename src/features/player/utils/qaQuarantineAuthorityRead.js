/**
 * OPERATION_B1B WP3 — thin set-based reader for canonical quarantine authority.
 *
 * Canonical RPC: qa_quarantine_list_active(p_profile_ids uuid[])
 * Forbidden alias: qa_quarantine_list_active_batched (must never be called/created here)
 *
 * Data minimization: runtime membership exposes profileId only.
 * Does not mutate profiles.status or auth.users.
 */

import { isQaQuarantineAuthorityFilterEnabled } from "../config/qaQuarantineFilterFlags.js";

/**
 * Lazy Supabase accessors — avoid hard-loading @supabase/supabase-js at module
 * import time so sync filter unit tests remain dependency-light.
 */
async function loadDefaultSupabaseAccessors() {
  const mod = await import("../../../auth/supabaseClient.js");
  return {
    getClient: mod.getSupabaseAuthClient,
    hasConfig: mod.hasSupabaseConfig,
  };
}

/** Sole canonical set-based active quarantine read (WP2 contract). */
export const QA_QUARANTINE_LIST_ACTIVE_RPC = "qa_quarantine_list_active";

/** Deprecated/non-canonical — must remain absent from runtime calls. */
export const FORBIDDEN_QA_QUARANTINE_LIST_ACTIVE_BATCHED =
  "qa_quarantine_list_active_batched";

/** Matches WP2 RPC input ceiling. */
export const QA_QUARANTINE_LIST_ACTIVE_MAX_IDS = 500;

export const QA_QUARANTINE_READ_STATUS = Object.freeze({
  OK: "ok",
  FLAG_OFF: "flag_off",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
  FORBIDDEN: "forbidden",
  EMPTY_INPUT: "empty_input",
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

/**
 * Collect profile UUIDs from directory/athlete rows (set-based, no per-row RPC).
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string[]}
 */
export function collectProfileIdsForQuarantineLookup(rows = []) {
  const ids = new Set();
  for (const row of rows || []) {
    const candidates = [
      row?.profileId,
      row?.profile_id,
      row?.authUserId,
      row?.auth_user_id,
      row?.userId,
      row?.user_id,
      row?.id,
    ];
    for (const candidate of candidates) {
      const value = String(candidate || "").trim();
      if (isUuid(value)) {
        ids.add(value.toLowerCase());
      }
    }
  }
  return Array.from(ids);
}

/**
 * @param {unknown} error
 * @returns {"unavailable"|"forbidden"|"error"}
 */
export function classifyQaQuarantineRpcError(error) {
  const code = String(error?.code || error?.error_code || "").toUpperCase();
  const message = String(error?.message || error?.details || error || "").toLowerCase();

  // Missing function / schema cache miss → bounded migration fallback.
  if (
    code === "PGRST202" ||
    code === "42883" ||
    message.includes("could not find the function") ||
    (message.includes("does not exist") &&
      (message.includes("qa_quarantine_list_active") || message.includes("function")))
  ) {
    return QA_QUARANTINE_READ_STATUS.UNAVAILABLE;
  }

  if (
    code === "42501" ||
    message.includes("qa_quarantine_forbidden") ||
    message.includes("permission denied") ||
    (code === "P0001" && message.includes("forbidden"))
  ) {
    return QA_QUARANTINE_READ_STATUS.FORBIDDEN;
  }

  return QA_QUARANTINE_READ_STATUS.ERROR;
}

/**
 * Project RPC rows → minimized active membership ids only.
 * Strips expected_email, allowlist/snapshot SHA, reason, audit/backup metadata.
 * @param {unknown} data
 * @returns {Set<string>}
 */
export function projectActiveMembershipIds(data) {
  const active = new Set();
  if (!Array.isArray(data)) return active;
  for (const row of data) {
    const profileId = String(row?.profile_id || row?.profileId || "").trim().toLowerCase();
    if (isUuid(profileId)) {
      active.add(profileId);
    }
  }
  return active;
}

/**
 * Attach distinguishable canonical membership signal onto rows.
 * Does not copy sensitive quarantine metadata onto consumers.
 *
 * @template T
 * @param {T[]} rows
 * @param {Set<string>|Iterable<string>} activeProfileIds
 * @returns {T[]}
 */
export function projectCanonicalAuthorityOntoRows(rows = [], activeProfileIds = []) {
  const activeSet =
    activeProfileIds instanceof Set
      ? activeProfileIds
      : new Set(
          [...activeProfileIds].map((id) => String(id || "").trim().toLowerCase()).filter(isUuid)
        );

  return (rows || []).map((row) => {
    const candidates = [
      row?.profileId,
      row?.profile_id,
      row?.authUserId,
      row?.auth_user_id,
      row?.userId,
      row?.user_id,
      row?.id,
    ];
    let matched = false;
    for (const candidate of candidates) {
      const value = String(candidate || "").trim().toLowerCase();
      if (isUuid(value) && activeSet.has(value)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Leave row unchanged when not in active set (no false quarantine mark).
      if (row?.qaAuthorityActive === true) {
        const rest = { ...row };
        delete rest.qaAuthorityActive;
        return rest;
      }
      return row;
    }
    return {
      ...row,
      // Distinguishable canonical signal (not legacy quarantined / meta / status).
      qaAuthorityActive: true,
    };
  });
}

function chunkIds(ids, size) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

/**
 * One set-based (chunked) authority lookup for an entire result set.
 * Missing/error RPC never invents quarantine membership.
 *
 * @param {string[]} profileIds
 * @param {{
 *   getClient?: () => { rpc: Function }|null,
 *   hasConfig?: () => boolean,
 *   envSource?: Record<string, unknown>|null,
 *   authorityFilterEnabled?: boolean,
 * }} [deps]
 */
export async function listActiveQaQuarantineMembership(profileIds = [], deps = {}) {
  const enabled =
    typeof deps.authorityFilterEnabled === "boolean"
      ? deps.authorityFilterEnabled
      : isQaQuarantineAuthorityFilterEnabled(deps.envSource);

  if (!enabled) {
    return {
      ok: true,
      status: QA_QUARANTINE_READ_STATUS.FLAG_OFF,
      activeProfileIds: new Set(),
      rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
      queryCount: 0,
      reason: "feature_flag_off",
    };
  }

  const uniqueIds = [
    ...new Set(
      (profileIds || [])
        .map((id) => String(id || "").trim().toLowerCase())
        .filter(isUuid)
    ),
  ];

  if (uniqueIds.length === 0) {
    return {
      ok: true,
      status: QA_QUARANTINE_READ_STATUS.EMPTY_INPUT,
      activeProfileIds: new Set(),
      rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
      queryCount: 0,
      reason: "no_profile_ids",
    };
  }

  let hasConfig = deps.hasConfig;
  let getClient = deps.getClient;
  if (typeof hasConfig !== "function" || typeof getClient !== "function") {
    const defaults = await loadDefaultSupabaseAccessors();
    hasConfig = typeof hasConfig === "function" ? hasConfig : defaults.hasConfig;
    getClient = typeof getClient === "function" ? getClient : defaults.getClient;
  }

  if (!hasConfig()) {
    return {
      ok: false,
      status: QA_QUARANTINE_READ_STATUS.UNAVAILABLE,
      activeProfileIds: new Set(),
      rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
      queryCount: 0,
      reason: "supabase_unconfigured",
      // Explicit: do not classify anyone as quarantined from absence.
      fallback: "legacy_qa_signals_only",
    };
  }

  const client = getClient();
  if (!client || typeof client.rpc !== "function") {
    return {
      ok: false,
      status: QA_QUARANTINE_READ_STATUS.UNAVAILABLE,
      activeProfileIds: new Set(),
      rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
      queryCount: 0,
      reason: "client_unavailable",
      fallback: "legacy_qa_signals_only",
    };
  }

  const activeProfileIds = new Set();
  let queryCount = 0;

  for (const batch of chunkIds(uniqueIds, QA_QUARANTINE_LIST_ACTIVE_MAX_IDS)) {
    queryCount += 1;
    let result;
    try {
      // Canonical only — never call qa_quarantine_list_active_batched.
      result = await client.rpc(QA_QUARANTINE_LIST_ACTIVE_RPC, {
        p_profile_ids: batch,
      });
    } catch (error) {
      const status = classifyQaQuarantineRpcError(error);
      return {
        ok: false,
        status,
        activeProfileIds: new Set(),
        rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
        queryCount,
        reason: String(error?.message || status),
        fallback: "legacy_qa_signals_only",
        error,
      };
    }

    if (result?.error) {
      const status = classifyQaQuarantineRpcError(result.error);
      return {
        ok: false,
        status,
        activeProfileIds: new Set(),
        rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
        queryCount,
        reason: String(result.error?.message || status),
        fallback: "legacy_qa_signals_only",
        error: result.error,
      };
    }

    for (const id of projectActiveMembershipIds(result?.data)) {
      activeProfileIds.add(id);
    }
  }

  return {
    ok: true,
    status: QA_QUARANTINE_READ_STATUS.OK,
    activeProfileIds,
    rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
    queryCount,
    reason: null,
  };
}
