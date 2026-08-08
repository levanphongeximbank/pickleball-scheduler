/**
 * OPERATION_B1B WP3 — thin set-based reader for canonical quarantine authority.
 *
 * Canonical RPC: qa_quarantine_list_active(p_profile_ids uuid[])
 * Forbidden alias: qa_quarantine_list_active_batched (must never be called/created here)
 *
 * Wire + consumer minimization: membership key is profile_id only.
 * Does not mutate profiles.status or auth.users.
 *
 * MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE = 1 (no client-side chunking).
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

/** Sole canonical set-based active quarantine read (WP2/WP3 contract). */
export const QA_QUARANTINE_LIST_ACTIVE_RPC = "qa_quarantine_list_active";

/** Deprecated/non-canonical — must remain absent from runtime calls. */
export const FORBIDDEN_QA_QUARANTINE_LIST_ACTIVE_BATCHED =
  "qa_quarantine_list_active_batched";

/**
 * Matches WP2/WP3 RPC input ceiling for one page-sized set-based call.
 * Client MUST NOT chunk; one Players page → one authority RPC.
 */
export const QA_QUARANTINE_LIST_ACTIVE_MAX_IDS = 10000;

/** Anti-N+1 acceptance gate for directory/list surfaces. */
export const MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE = 1;

/** Columns requested on the RPC result (wire minimization). */
export const QA_QUARANTINE_LIST_ACTIVE_SELECT = "profile_id";

export const QA_QUARANTINE_READ_STATUS = Object.freeze({
  OK: "ok",
  FLAG_OFF: "flag_off",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
  FORBIDDEN: "forbidden",
  EMPTY_INPUT: "empty_input",
  INPUT_TOO_LARGE: "input_too_large",
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_ROUTE_ID_RE =
  /^profile-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

/**
 * Extract a quarantine profile key from an explicit binding only.
 * Generic UUID-shaped `id` is NOT accepted (avoids false-match on player/roster ids).
 * Proven bindings: profileId/profile_id, authUserId/auth_user_id, userId/user_id,
 * and id only when shaped as `profile-<uuid>` (platform athlete route contract).
 *
 * @param {Record<string, unknown>} row
 * @returns {string[]}
 */
export function extractProfileKeysFromRow(row = {}) {
  const keys = [];
  const pushUuid = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (isUuid(normalized)) keys.push(normalized);
  };

  pushUuid(row?.profileId);
  pushUuid(row?.profile_id);
  pushUuid(row?.authUserId);
  pushUuid(row?.auth_user_id);
  pushUuid(row?.userId);
  pushUuid(row?.user_id);

  const routeId = String(row?.id || "").trim();
  const routeMatch = PROFILE_ROUTE_ID_RE.exec(routeId);
  if (routeMatch) {
    pushUuid(routeMatch[1]);
  }

  return keys;
}

/**
 * Collect profile UUIDs from directory/athlete rows (set-based, no per-row RPC).
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string[]}
 */
export function collectProfileIdsForQuarantineLookup(rows = []) {
  const ids = new Set();
  for (const row of rows || []) {
    for (const key of extractProfileKeysFromRow(row)) {
      ids.add(key);
    }
  }
  return Array.from(ids);
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function classifyQaQuarantineRpcError(error) {
  const code = String(error?.code || error?.error_code || "").toUpperCase();
  const message = String(error?.message || error?.details || error || "").toLowerCase();

  if (
    code === "PGRST202" ||
    code === "42883" ||
    message.includes("could not find the function") ||
    (message.includes("does not exist") &&
      (message.includes("qa_quarantine_list_active") || message.includes("function")))
  ) {
    return QA_QUARANTINE_READ_STATUS.UNAVAILABLE;
  }

  if (message.includes("qa_quarantine_input_too_large") || message.includes("profile_ids max")) {
    return QA_QUARANTINE_READ_STATUS.INPUT_TOO_LARGE;
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
 * Accepts only profile_id / profileId keys from the wire payload.
 * @param {unknown} data
 * @returns {Set<string>}
 */
export function projectActiveMembershipIds(data) {
  const active = new Set();
  if (!Array.isArray(data)) return active;
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const keys = Object.keys(row);
    // Reject unexpected operational/sensitive fields if a wider payload leaks.
    const disallowed = keys.filter(
      (k) =>
        ![
          "profile_id",
          "profileId",
        ].includes(k)
    );
    if (disallowed.length > 0) {
      // Ignore extra fields for membership projection; do not surface them.
    }
    const profileId = String(row?.profile_id || row?.profileId || "")
      .trim()
      .toLowerCase();
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
    const matched = extractProfileKeysFromRow(row).some((key) => activeSet.has(key));
    if (!matched) {
      if (row?.qaAuthorityActive === true) {
        const rest = { ...row };
        delete rest.qaAuthorityActive;
        return rest;
      }
      return row;
    }
    return {
      ...row,
      qaAuthorityActive: true,
    };
  });
}

/**
 * Bounded ops/dev observability when canonical authority is unavailable.
 * No emails, allowlist/snapshot hashes, batch ids, or reason text from authority rows.
 *
 * @param {object} authority
 * @param {{ forceLog?: boolean, logger?: { info: Function } }} [options]
 */
export function observeQaQuarantineAuthorityAvailability(authority = {}, options = {}) {
  const status = String(authority?.status || "");
  if (!status || status === QA_QUARANTINE_READ_STATUS.OK) return;
  if (
    status === QA_QUARANTINE_READ_STATUS.FLAG_OFF ||
    status === QA_QUARANTINE_READ_STATUS.EMPTY_INPUT
  ) {
    return;
  }

  const env =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const nodeEnv =
    typeof globalThis.process !== "undefined" ? globalThis.process.env : {};
  const debugEnabled =
    options.forceLog === true ||
    env.DEV === true ||
    env.VITE_ENABLE_AUTH_DEBUG === "true" ||
    nodeEnv.VITE_ENABLE_AUTH_DEBUG === "true";

  if (!debugEnabled) return;

  const logger = options.logger || console;
  if (typeof logger.info !== "function") return;

  logger.info("[qa-quarantine-authority]", {
    status,
    reason: authority.reason || null,
    fallback: authority.fallback || "legacy_qa_signals_only",
    rpcName: authority.rpcName || QA_QUARANTINE_LIST_ACTIVE_RPC,
    queryCount: authority.queryCount ?? 0,
    // Explicit: transitional dual-read only; removal after WP5/WP6 proofs.
    legacyFallbackTransitional: true,
  });
}

/**
 * Invoke RPC with optional PostgREST column projection (.select).
 * @param {{ rpc: Function }} client
 * @param {string[]} profileIds
 */
async function invokeListActiveRpc(client, profileIds) {
  const builder = client.rpc(QA_QUARANTINE_LIST_ACTIVE_RPC, {
    p_profile_ids: profileIds,
  });

  // Prefer wire projection at the PostgREST boundary when supported.
  if (builder && typeof builder.select === "function") {
    return builder.select(QA_QUARANTINE_LIST_ACTIVE_SELECT);
  }

  return builder;
}

/**
 * Exactly one set-based authority lookup for an entire page/result set.
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
      selectedFields: [QA_QUARANTINE_LIST_ACTIVE_SELECT],
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
      selectedFields: [QA_QUARANTINE_LIST_ACTIVE_SELECT],
    };
  }

  if (uniqueIds.length > QA_QUARANTINE_LIST_ACTIVE_MAX_IDS) {
    return {
      ok: false,
      status: QA_QUARANTINE_READ_STATUS.INPUT_TOO_LARGE,
      activeProfileIds: new Set(),
      rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
      queryCount: 0,
      reason: `profile_ids max ${QA_QUARANTINE_LIST_ACTIVE_MAX_IDS}`,
      fallback: "legacy_qa_signals_only",
      selectedFields: [QA_QUARANTINE_LIST_ACTIVE_SELECT],
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
      fallback: "legacy_qa_signals_only",
      selectedFields: [QA_QUARANTINE_LIST_ACTIVE_SELECT],
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
      selectedFields: [QA_QUARANTINE_LIST_ACTIVE_SELECT],
    };
  }

  let result;
  try {
    // Canonical only — never call qa_quarantine_list_active_batched.
    // Exactly one RPC for the page dataset (no chunk loop).
    result = await invokeListActiveRpc(client, uniqueIds);
  } catch (error) {
    const status = classifyQaQuarantineRpcError(error);
    return {
      ok: false,
      status,
      activeProfileIds: new Set(),
      rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
      queryCount: 1,
      reason: String(error?.message || status),
      fallback: "legacy_qa_signals_only",
      selectedFields: [QA_QUARANTINE_LIST_ACTIVE_SELECT],
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
      queryCount: 1,
      reason: String(result.error?.message || status),
      fallback: "legacy_qa_signals_only",
      selectedFields: [QA_QUARANTINE_LIST_ACTIVE_SELECT],
      error: result.error,
    };
  }

  return {
    ok: true,
    status: QA_QUARANTINE_READ_STATUS.OK,
    activeProfileIds: projectActiveMembershipIds(result?.data),
    rpcName: QA_QUARANTINE_LIST_ACTIVE_RPC,
    queryCount: 1,
    reason: null,
    selectedFields: [QA_QUARANTINE_LIST_ACTIVE_SELECT],
  };
}
