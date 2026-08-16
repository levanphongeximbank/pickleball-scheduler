/**
 * Request-local Supabase call counters for Preview latency accounting.
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

function bump(counters, tableOrRpc) {
  if (!counters) return;
  counters.SUPABASE_REQUEST_COUNT += 1;
  if (tableOrRpc === "__rpc__") {
    counters.WRITE_RPC_COUNT += 1;
    return;
  }
  classifyTable(tableOrRpc, counters);
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
      bump(getActiveSupabaseCounters(), "__rpc__");
      return origRpc(...args);
    };
  }
  if (client.auth && typeof client.auth.getUser === "function") {
    const origGetUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = async (...args) => {
      const counters = getActiveSupabaseCounters();
      if (counters) {
        counters.SUPABASE_REQUEST_COUNT += 1;
        counters.AUTH_NETWORK_COUNT += 1;
      }
      return origGetUser(...args);
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
