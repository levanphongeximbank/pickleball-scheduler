/**
 * Request-local Supabase call counters + ordered ledger for Preview latency accounting.
 * Uses AsyncLocalStorage so warm-lambda shared clients stay concurrency-safe.
 */

import { AsyncLocalStorage } from "node:async_hooks";

const counterStorage = new AsyncLocalStorage();

export function createEmptySupabaseRequestCounters() {
  return {
    SUPABASE_REQUEST_COUNT: 0,
    AUTH_NETWORK_COUNT: 0,
    ASSIGNMENT_READ_COUNT: 0,
    MODE_STATE_READ_COUNT: 0,
    MATCH_STATE_READ_COUNT: 0,
    LIVE_STATE_READ_COUNT: 0,
    EVENT_READ_COUNT: 0,
    WRITE_RPC_COUNT: 0,
    POST_WRITE_READ_COUNT: 0,
    LEDGER: [],
    COMMIT_SUBPHASES: null,
    _startedAt: Date.now(),
    _lastBumpAt: null,
  };
}

export function runWithSupabaseCounters(counters, fn) {
  return counterStorage.run(counters, fn);
}

export function getActiveSupabaseCounters() {
  return counterStorage.getStore() || null;
}

function classifyTable(table, counters) {
  const name = String(table || "");
  if (name === "referee_assignments") counters.ASSIGNMENT_READ_COUNT += 1;
  else if (name === "match_live_states") counters.LIVE_STATE_READ_COUNT += 1;
  else if (name.includes("event")) counters.EVENT_READ_COUNT += 1;
  else if (
    name.startsWith("team_tournament") ||
    name.startsWith("canonical_") ||
    name.includes("tournament") ||
    name.includes("match")
  ) {
    counters.MODE_STATE_READ_COUNT += 1;
    counters.MATCH_STATE_READ_COUNT += 1;
  } else if (name === "profiles") {
    counters.AUTH_NETWORK_COUNT += 1;
  }
}

function inferOperation(tableOrRpc) {
  if (tableOrRpc === "__rpc__") return "RPC";
  if (tableOrRpc === "__auth_get_user__") return "AUTH_GET_USER";
  const name = String(tableOrRpc || "");
  if (name === "profiles") return "AUTH_PROFILE_READ";
  if (name === "referee_assignments") return "ASSIGNMENT_READ";
  if (name === "match_live_states") return "LIVE_STATE_READ";
  if (name.includes("event")) return "EVENT_READ";
  if (name.includes("sync_mutation")) return "SYNC_MUTATION";
  if (name.includes("result_revision")) return "RESULT_REVISION";
  return `FROM_${name || "unknown"}`;
}

/**
 * Append a ledger row (manual timed ops or auto-instrumented).
 * @param {object|null} counters
 * @param {{
 *   operation: string,
 *   tableOrRpc?: string,
 *   kind?: "read"|"write"|"auth",
 *   elapsedMs?: number|null,
 *   required?: boolean,
 *   reused?: boolean,
 *   removed?: boolean,
 *   duplicateOf?: string|null,
 *   canReuseRequestLocal?: boolean,
 *   canCombineWith?: string|null,
 * }} entry
 */
export function noteSupabaseLedgerEntry(counters, entry) {
  if (!counters || !entry?.operation) return;
  const list = counters.LEDGER || (counters.LEDGER = []);
  list.push(
    Object.freeze({
      seq: list.length + 1,
      operation: String(entry.operation),
      tableOrRpc: entry.tableOrRpc || null,
      kind: entry.kind || "read",
      elapsedMs: entry.elapsedMs == null ? null : Number(entry.elapsedMs),
      required: entry.required !== false,
      reused: entry.reused === true,
      removed: entry.removed === true,
      duplicateOf: entry.duplicateOf || null,
      canReuseRequestLocal: entry.canReuseRequestLocal === true,
      canCombineWith: entry.canCombineWith || null,
    })
  );
}

export function noteCommitSubphases(counters, subphases) {
  if (!counters || !subphases) return;
  counters.COMMIT_SUBPHASES = Object.freeze({ ...subphases });
}

function bump(counters, tableOrRpc, meta = {}) {
  if (!counters) return;
  const now = Date.now();
  const last = counters._lastBumpAt || counters._startedAt || now;
  const gapMs = now - last;
  counters._lastBumpAt = now;
  counters.SUPABASE_REQUEST_COUNT += 1;
  if (tableOrRpc === "__rpc__") {
    counters.WRITE_RPC_COUNT += 1;
  } else if (tableOrRpc === "__auth_get_user__") {
    counters.AUTH_NETWORK_COUNT += 1;
  } else {
    classifyTable(tableOrRpc, counters);
  }
  noteSupabaseLedgerEntry(counters, {
    operation: meta.operation || inferOperation(tableOrRpc),
    tableOrRpc: tableOrRpc === "__auth_get_user__" ? "auth.getUser" : tableOrRpc,
    kind: meta.kind || (tableOrRpc === "__rpc__" ? "write" : tableOrRpc === "__auth_get_user__" ? "auth" : "read"),
    elapsedMs: meta.elapsedMs != null ? meta.elapsedMs : gapMs,
    required: meta.required,
    reused: meta.reused,
    removed: meta.removed,
    duplicateOf: meta.duplicateOf,
    canReuseRequestLocal: meta.canReuseRequestLocal,
    canCombineWith: meta.canCombineWith,
  });
}

/**
 * Instrument a shared supabase client once. Counts only when an ALS store is active.
 * @param {object} client
 */
export function instrumentSharedSupabaseClient(client) {
  if (!client || client.__pickVnSupabaseInstrumented) return client;

  const origFrom = typeof client.from === "function" ? client.from.bind(client) : null;
  const origRpc = typeof client.rpc === "function" ? client.rpc.bind(client) : null;

  if (origFrom) {
    client.from = (table) => {
      bump(getActiveSupabaseCounters(), table);
      return origFrom(table);
    };
  }
  if (origRpc) {
    client.rpc = (...args) => {
      const rpcName = typeof args[0] === "string" ? args[0] : "__rpc__";
      bump(getActiveSupabaseCounters(), "__rpc__", {
        operation: `RPC_${rpcName}`,
        kind: "write",
        required: true,
      });
      return origRpc(...args);
    };
  }
  if (client.auth && typeof client.auth.getUser === "function") {
    const origGetUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = async (...args) => {
      const counters = getActiveSupabaseCounters();
      const t0 = Date.now();
      const result = await origGetUser(...args);
      if (counters) {
        bump(counters, "__auth_get_user__", {
          operation: "AUTH_GET_USER",
          kind: "auth",
          elapsedMs: Date.now() - t0,
          required: true,
          canReuseRequestLocal: false,
        });
      }
      return result;
    };
  }

  client.__pickVnSupabaseInstrumented = true;
  return client;
}

/** Call after durable write when a fresh live row is read. */
export function notePostWriteLiveRead(counters) {
  if (!counters) return;
  counters.POST_WRITE_READ_COUNT += 1;
}

/**
 * Freeze a public diagnostic snapshot of counters (no secrets).
 * @param {object} counters
 */
export function snapshotSupabaseCounters(counters) {
  if (!counters) return null;
  return Object.freeze({
    SUPABASE_REQUEST_COUNT: counters.SUPABASE_REQUEST_COUNT,
    AUTH_NETWORK_COUNT: counters.AUTH_NETWORK_COUNT,
    ASSIGNMENT_READ_COUNT: counters.ASSIGNMENT_READ_COUNT,
    MODE_STATE_READ_COUNT: counters.MODE_STATE_READ_COUNT,
    MATCH_STATE_READ_COUNT: counters.MATCH_STATE_READ_COUNT,
    LIVE_STATE_READ_COUNT: counters.LIVE_STATE_READ_COUNT,
    EVENT_READ_COUNT: counters.EVENT_READ_COUNT,
    WRITE_RPC_COUNT: counters.WRITE_RPC_COUNT,
    POST_WRITE_READ_COUNT: counters.POST_WRITE_READ_COUNT,
    LEDGER: Object.freeze([...(counters.LEDGER || [])]),
    COMMIT_SUBPHASES: counters.COMMIT_SUBPHASES
      ? Object.freeze({ ...counters.COMMIT_SUBPHASES })
      : null,
  });
}
