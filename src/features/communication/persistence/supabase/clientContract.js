/**
 * Minimal Supabase-compatible client contract for Communication durable adapters (COMMS-05).
 * No global singleton. No env access. No network in tests.
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../../errors/errorCodes.js";
import { CommunicationFoundationError } from "../../errors/CommunicationFoundationError.js";
import {
  COMMUNICATION_TABLE_NAME_VALUES,
  FORBIDDEN_NON_COMMUNICATION_TABLES,
} from "../schema.js";

/**
 * @param {unknown} client
 * @returns {object}
 */
export function assertSupabaseCommunicationClient(client) {
  if (client == null || typeof client !== "object") {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      "Communication Supabase adapter requires an explicitly injected client.",
      { field: "client" }
    );
  }
  if (typeof /** @type {{ from?: unknown }} */ (client).from !== "function") {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      "Injected Communication client must expose from(table).",
      { field: "client.from" }
    );
  }
  return client;
}

/**
 * @param {string} table
 */
export function assertCommunicationTableName(table) {
  if (!COMMUNICATION_TABLE_NAME_VALUES.includes(table)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      `Refusing non-Communication table: ${table}`,
      { table }
    );
  }
  if (FORBIDDEN_NON_COMMUNICATION_TABLES.includes(table)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      `Refusing foreign SoT table from Communication adapter: ${table}`,
      { table }
    );
  }
  return table;
}

/**
 * Deterministic fake Supabase client for Communication adapter tests only.
 *
 * @param {{ seed?: Record<string, object[]>, errors?: Record<string, object>, rpcResults?: Record<string, unknown> }} [options]
 */
export function createFakeSupabaseCommunicationClient(options = {}) {
  /** @type {Map<string, object[]>} */
  const store = new Map();
  for (const table of COMMUNICATION_TABLE_NAME_VALUES) {
    store.set(table, []);
  }
  if (options.seed && typeof options.seed === "object") {
    for (const [table, rows] of Object.entries(options.seed)) {
      assertCommunicationTableName(table);
      store.set(table, Array.isArray(rows) ? rows.map((r) => ({ ...r })) : []);
    }
  }

  /** @type {object[]} */
  const calls = [];
  /** @type {Record<string, object>} */
  const scriptedErrors = { ...(options.errors || {}) };
  /** @type {Record<string, unknown>} */
  const rpcResults = { ...(options.rpcResults || {}) };
  /** @type {Map<string, number>} */
  const positionCounters = new Map();

  function cloneRow(row) {
    return JSON.parse(JSON.stringify(row));
  }

  function matchesFilters(row, filters) {
    for (const f of filters) {
      const value = row[f.column];
      if (f.op === "eq" && value !== f.value) return false;
      if (f.op === "neq" && value === f.value) return false;
      if (f.op === "is") {
        if (f.value === null && value != null) return false;
        if (f.value !== null && value !== f.value) return false;
      }
      if (f.op === "in" && !f.value.includes(value)) return false;
      if (f.op === "gte" && !(value >= f.value)) return false;
      if (f.op === "lte" && !(value <= f.value)) return false;
      if (f.op === "lt" && !(value < f.value)) return false;
      if (f.op === "gt" && !(value > f.value)) return false;
    }
    return true;
  }

  function uniqueConflict(table, row) {
    const rows = store.get(table) || [];
    if (table === "communication_conversations") {
      if (rows.some((r) => r.conversation_id === row.conversation_id)) {
        return { code: "23505", message: "duplicate key", details: "communication_conversations_pkey" };
      }
      if (
        row.direct_pair_key &&
        rows.some((r) => r.direct_pair_key === row.direct_pair_key)
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_conversations_direct_pair_uidx" };
      }
      if (
        row.channel_key &&
        rows.some((r) => r.channel_key === row.channel_key)
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_conversations_channel_key_uidx" };
      }
    }
    if (table === "communication_conversation_participants") {
      if (
        rows.some(
          (r) =>
            r.conversation_id === row.conversation_id &&
            r.participant_id === row.participant_id
        )
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_conversation_participants_pkey" };
      }
    }
    if (table === "communication_messages") {
      if (rows.some((r) => r.message_id === row.message_id)) {
        return { code: "23505", message: "duplicate key", details: "communication_messages_pkey" };
      }
      if (
        rows.some(
          (r) =>
            r.conversation_id === row.conversation_id &&
            r.position === row.position
        )
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_messages_conv_position_uidx" };
      }
      if (
        row.client_idempotency_key &&
        rows.some(
          (r) =>
            r.conversation_id === row.conversation_id &&
            r.client_idempotency_key === row.client_idempotency_key
        )
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_messages_conv_idempotency_uidx" };
      }
    }
    if (table === "communication_direct_requests") {
      if (rows.some((r) => r.request_id === row.request_id)) {
        return { code: "23505", message: "duplicate key", details: "communication_direct_requests_pkey" };
      }
      if (
        row.status === "PENDING" &&
        rows.some((r) => r.pair_key === row.pair_key && r.status === "PENDING")
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_direct_requests_pending_pair_uidx" };
      }
    }
    if (table === "communication_pinned_messages") {
      if (
        rows.some(
          (r) =>
            r.conversation_id === row.conversation_id &&
            r.message_id === row.message_id
        )
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_pinned_messages_pkey" };
      }
    }
    if (table === "communication_message_reactions") {
      if (
        rows.some(
          (r) =>
            r.message_id === row.message_id &&
            r.participant_id === row.participant_id &&
            r.emoji === row.emoji
        )
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_reactions_unique_uidx" };
      }
    }
    if (table === "communication_user_blocks") {
      if (
        rows.some(
          (r) =>
            r.blocker_participant_id === row.blocker_participant_id &&
            r.blocked_participant_id === row.blocked_participant_id
        )
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_user_blocks_edge_uidx" };
      }
    }
    if (table === "communication_idempotency") {
      if (
        rows.some(
          (r) =>
            r.operation_type === row.operation_type &&
            r.idempotency_key === row.idempotency_key
        )
      ) {
        return { code: "23505", message: "duplicate key", details: "communication_idempotency_pkey" };
      }
    }
    return null;
  }

  function createBuilder(table) {
    assertCommunicationTableName(table);
    /** @type {{ type: string, payload?: object|object[], filters: object[], order: object|null, limit: number|null, want: string|null, deleteMode?: boolean }} */
    const state = {
      type: "select",
      payload: undefined,
      filters: [],
      order: null,
      limit: null,
      want: null,
      deleteMode: false,
    };

    const builder = {
      select() {
        if (
          state.type === "insert" ||
          state.type === "update" ||
          state.type === "upsert" ||
          state.type === "delete"
        ) {
          return builder;
        }
        state.type = "select";
        return builder;
      },
      insert(payload) {
        state.type = "insert";
        state.payload = payload;
        return builder;
      },
      upsert(payload) {
        state.type = "upsert";
        state.payload = payload;
        return builder;
      },
      update(payload) {
        state.type = "update";
        state.payload = payload;
        return builder;
      },
      delete() {
        state.type = "delete";
        state.deleteMode = true;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ op: "eq", column, value });
        return builder;
      },
      neq(column, value) {
        state.filters.push({ op: "neq", column, value });
        return builder;
      },
      is(column, value) {
        state.filters.push({ op: "is", column, value });
        return builder;
      },
      in(column, values) {
        state.filters.push({ op: "in", column, value: values });
        return builder;
      },
      gte(column, value) {
        state.filters.push({ op: "gte", column, value });
        return builder;
      },
      lte(column, value) {
        state.filters.push({ op: "lte", column, value });
        return builder;
      },
      gt(column, value) {
        state.filters.push({ op: "gt", column, value });
        return builder;
      },
      lt(column, value) {
        state.filters.push({ op: "lt", column, value });
        return builder;
      },
      order(column, opts = {}) {
        state.order = { column, ascending: opts.ascending !== false };
        return builder;
      },
      limit(n) {
        state.limit = n;
        return builder;
      },
      maybeSingle() {
        state.want = "maybeSingle";
        return builder;
      },
      single() {
        state.want = "single";
        return builder;
      },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => execute())
          .then(resolve, reject);
      },
    };

    async function execute() {
      calls.push({
        table,
        type: state.type,
        filters: state.filters.map((f) => ({ ...f })),
        payload: state.payload == null ? null : cloneRow(state.payload),
        order: state.order,
        limit: state.limit,
        want: state.want,
      });

      const scriptKey = `${table}:${state.type}`;
      if (scriptedErrors[scriptKey]) {
        return { data: null, error: scriptedErrors[scriptKey] };
      }
      if (scriptedErrors[table]) {
        return { data: null, error: scriptedErrors[table] };
      }

      const rows = store.get(table) || [];

      if (state.type === "insert") {
        const incoming = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = [];
        for (const row of incoming) {
          const conflict = uniqueConflict(table, row);
          if (conflict) return { data: null, error: conflict };
          const stored = cloneRow(row);
          rows.push(stored);
          inserted.push(cloneRow(stored));
        }
        store.set(table, rows);
        if (state.want === "single" || state.want === "maybeSingle") {
          return { data: inserted[0] ?? null, error: null };
        }
        return { data: inserted, error: null };
      }

      if (state.type === "upsert") {
        const incoming = Array.isArray(state.payload) ? state.payload : [state.payload];
        const upserted = [];
        for (const row of incoming) {
          let idx = -1;
          if (table === "communication_read_cursors") {
            idx = rows.findIndex(
              (r) =>
                r.conversation_id === row.conversation_id &&
                r.participant_id === row.participant_id
            );
          } else if (table === "communication_conversations") {
            idx = rows.findIndex((r) => r.conversation_id === row.conversation_id);
          } else if (table === "communication_conversation_participants") {
            idx = rows.findIndex(
              (r) =>
                r.conversation_id === row.conversation_id &&
                r.participant_id === row.participant_id
            );
          } else if (row.id != null) {
            idx = rows.findIndex((r) => r.id === row.id);
          } else if (row.message_id != null && table === "communication_messages") {
            idx = rows.findIndex((r) => r.message_id === row.message_id);
          }
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...cloneRow(row) };
            upserted.push(cloneRow(rows[idx]));
          } else {
            const conflict = uniqueConflict(table, row);
            if (conflict) return { data: null, error: conflict };
            const stored = cloneRow(row);
            rows.push(stored);
            upserted.push(cloneRow(stored));
          }
        }
        store.set(table, rows);
        if (state.want === "single" || state.want === "maybeSingle") {
          return { data: upserted[0] ?? null, error: null };
        }
        return { data: upserted, error: null };
      }

      if (state.type === "update") {
        const matchedIndexes = [];
        for (let i = 0; i < rows.length; i += 1) {
          if (matchesFilters(rows[i], state.filters)) matchedIndexes.push(i);
        }
        if (matchedIndexes.length === 0) {
          if (state.want === "single") {
            return {
              data: null,
              error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
            };
          }
          return { data: null, error: null };
        }
        const patch = /** @type {object} */ (state.payload);
        const updated = [];
        for (const idx of matchedIndexes) {
          rows[idx] = { ...rows[idx], ...cloneRow(patch) };
          updated.push(cloneRow(rows[idx]));
        }
        store.set(table, rows);
        if (state.want === "single" || state.want === "maybeSingle") {
          return { data: updated[0] ?? null, error: null };
        }
        return { data: updated, error: null };
      }

      if (state.type === "delete") {
        const remaining = [];
        const deleted = [];
        for (const row of rows) {
          if (matchesFilters(row, state.filters)) deleted.push(cloneRow(row));
          else remaining.push(row);
        }
        store.set(table, remaining);
        if (state.want === "single" || state.want === "maybeSingle") {
          return { data: deleted[0] ?? null, error: null };
        }
        return { data: deleted, error: null };
      }

      let result = rows.filter((r) => matchesFilters(r, state.filters)).map(cloneRow);
      if (state.order) {
        const { column, ascending } = state.order;
        result.sort((a, b) => {
          const av = a[column];
          const bv = b[column];
          if (av === bv) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          const cmp = av < bv ? -1 : 1;
          return ascending ? cmp : -cmp;
        });
      }
      if (state.limit != null) result = result.slice(0, state.limit);

      if (state.want === "maybeSingle") {
        return { data: result[0] ?? null, error: null };
      }
      if (state.want === "single") {
        if (result.length !== 1) {
          return {
            data: null,
            error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
          };
        }
        return { data: result[0], error: null };
      }
      return { data: result, error: null };
    }

    return builder;
  }

  return Object.freeze({
    __testOnly: true,
    from(table) {
      return createBuilder(table);
    },
    async rpc(fnName, args = {}) {
      calls.push({ table: null, type: "rpc", fnName, args: cloneRow(args) });
      if (scriptedErrors[`rpc:${fnName}`]) {
        return { data: null, error: scriptedErrors[`rpc:${fnName}`] };
      }
      if (fnName === "communication_allocate_message_position") {
        const conversationId = args.p_conversation_id;
        const next = (positionCounters.get(conversationId) || 0) + 1;
        positionCounters.set(conversationId, next);
        return { data: next, error: null };
      }
      if (fnName === "communication_advance_read_cursor") {
        const table = "communication_read_cursors";
        const rows = store.get(table) || [];
        const idx = rows.findIndex(
          (r) =>
            r.conversation_id === args.p_conversation_id &&
            r.participant_id === args.p_participant_id
        );
        if (idx >= 0) {
          const current = rows[idx];
          if (args.p_last_read_at < current.last_read_at) {
            return {
              data: null,
              error: { code: "P0001", message: "COMMS read cursor regression" },
            };
          }
          rows[idx] = {
            ...current,
            last_read_at: args.p_last_read_at,
            last_read_message_id:
              args.p_last_read_message_id ?? current.last_read_message_id,
            last_read_position:
              args.p_last_read_position == null
                ? current.last_read_position
                : Math.max(
                    current.last_read_position || 0,
                    args.p_last_read_position
                  ),
            updated_at: new Date().toISOString(),
          };
          store.set(table, rows);
          return { data: cloneRow(rows[idx]), error: null };
        }
        const created = {
          conversation_id: args.p_conversation_id,
          participant_id: args.p_participant_id,
          last_read_at: args.p_last_read_at,
          last_read_message_id: args.p_last_read_message_id ?? null,
          last_read_position: args.p_last_read_position ?? null,
          updated_at: new Date().toISOString(),
        };
        rows.push(created);
        store.set(table, rows);
        return { data: cloneRow(created), error: null };
      }
      if (Object.prototype.hasOwnProperty.call(rpcResults, fnName)) {
        return { data: rpcResults[fnName], error: null };
      }
      return { data: null, error: { message: `Unknown rpc ${fnName}` } };
    },
    getCalls() {
      return Object.freeze(calls.map((c) => Object.freeze({ ...c })));
    },
    clearCalls() {
      calls.length = 0;
    },
    getRows(table) {
      assertCommunicationTableName(table);
      return Object.freeze((store.get(table) || []).map(cloneRow));
    },
    seedRow(table, row) {
      assertCommunicationTableName(table);
      const rows = store.get(table) || [];
      rows.push(cloneRow(row));
      store.set(table, rows);
    },
    setError(key, error) {
      scriptedErrors[key] = error;
    },
    resetAll() {
      for (const table of COMMUNICATION_TABLE_NAME_VALUES) store.set(table, []);
      calls.length = 0;
      positionCounters.clear();
      for (const key of Object.keys(scriptedErrors)) delete scriptedErrors[key];
    },
  });
}
