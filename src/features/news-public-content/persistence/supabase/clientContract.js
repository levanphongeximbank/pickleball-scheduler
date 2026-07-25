/**
 * Minimal Supabase-compatible client contract for News durable adapter (NEWS-02).
 * Injected client only. No global singleton. No env. No network at import time.
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../../errors/errorCodes.js";
import { NewsPublicContentError } from "../../errors/NewsPublicContentError.js";
import { NEWS_TABLE_NAME_VALUES } from "../schema.js";

/**
 * @param {unknown} client
 * @returns {object}
 */
export function assertSupabaseNewsClient(client) {
  if (client == null || typeof client !== "object") {
    throw new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      "News Supabase adapter requires an explicitly injected client.",
      { field: "client" }
    );
  }
  if (typeof /** @type {{ from?: unknown }} */ (client).from !== "function") {
    throw new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      "Injected News client must expose from(table).",
      { field: "client.from" }
    );
  }
  return client;
}

/**
 * @param {string} table
 */
export function assertNewsTableName(table) {
  if (!NEWS_TABLE_NAME_VALUES.includes(table)) {
    throw new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTRACT,
      `Refusing non-News table: ${table}`,
      { table }
    );
  }
  return table;
}

/**
 * Deterministic fake Supabase client for News adapter tests.
 * @param {{ seed?: Record<string, object[]>, errors?: Record<string, object>, rpcResults?: Record<string, unknown> }} [options]
 */
export function createFakeSupabaseNewsClient(options = {}) {
  /** @type {Map<string, object[]>} */
  const store = new Map();
  for (const table of NEWS_TABLE_NAME_VALUES) {
    store.set(table, []);
  }
  if (options.seed && typeof options.seed === "object") {
    for (const [table, rows] of Object.entries(options.seed)) {
      assertNewsTableName(table);
      store.set(table, Array.isArray(rows) ? rows.map((r) => ({ ...r })) : []);
    }
  }

  /** @type {object[]} */
  const calls = [];
  /** @type {Record<string, object>} */
  const scriptedErrors = { ...(options.errors || {}) };
  /** @type {Record<string, unknown>} */
  const rpcResults = { ...(options.rpcResults || {}) };

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
    }
    return true;
  }

  function createBuilder(table) {
    assertNewsTableName(table);
    /** @type {{ type: string, payload?: object|object[], filters: object[], order: object|null, limit: number|null, want: string|null }} */
    const state = {
      type: "select",
      payload: undefined,
      filters: [],
      order: null,
      limit: null,
      want: null,
    };

    const builder = {
      select() {
        if (state.type === "insert" || state.type === "update") return builder;
        state.type = "select";
        return builder;
      },
      insert(payload) {
        state.type = "insert";
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
        const incoming = Array.isArray(state.payload)
          ? state.payload
          : [state.payload];
        const inserted = [];
        for (const row of incoming) {
          if (
            table === "news_public_content_revisions" &&
            rows.some(
              (r) =>
                (r.revision_id === row.revision_id) ||
                (r.content_id === row.content_id && r.version === row.version)
            )
          ) {
            return {
              data: null,
              error: {
                code: "23505",
                message: "duplicate key value violates unique constraint",
                details: "news_public_content_revisions_content_version_uq",
              },
            };
          }
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

      if (state.type === "update") {
        const matchedIndexes = [];
        for (let i = 0; i < rows.length; i += 1) {
          if (matchesFilters(rows[i], state.filters)) matchedIndexes.push(i);
        }
        if (matchedIndexes.length === 0) {
          if (state.want === "single") {
            return {
              data: null,
              error: {
                code: "PGRST116",
                message:
                  "JSON object requested, multiple (or no) rows returned",
              },
            };
          }
          return { data: [], error: null };
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
        const kept = [];
        const removed = [];
        for (const row of rows) {
          if (matchesFilters(row, state.filters)) removed.push(cloneRow(row));
          else kept.push(row);
        }
        store.set(table, kept);
        return { data: removed, error: null };
      }

      let result = rows
        .filter((r) => matchesFilters(r, state.filters))
        .map(cloneRow);
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
            error: {
              code: "PGRST116",
              message:
                "JSON object requested, multiple (or no) rows returned",
            },
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
    async rpc(name, args) {
      calls.push({ table: null, type: "rpc", rpc: name, args: cloneRow(args || {}) });
      if (scriptedErrors[`rpc:${name}`]) {
        return { data: null, error: scriptedErrors[`rpc:${name}`] };
      }
      if (Object.prototype.hasOwnProperty.call(rpcResults, name)) {
        return { data: rpcResults[name], error: null };
      }
      return { data: null, error: null };
    },
    getCalls() {
      return Object.freeze(calls.map((c) => Object.freeze({ ...c })));
    },
    clearCalls() {
      calls.length = 0;
    },
    getRows(table) {
      assertNewsTableName(table);
      return Object.freeze((store.get(table) || []).map(cloneRow));
    },
    seedRow(table, row) {
      assertNewsTableName(table);
      const rows = store.get(table) || [];
      rows.push(cloneRow(row));
      store.set(table, rows);
    },
    setError(key, error) {
      scriptedErrors[key] = error;
    },
    setRpcResult(name, data) {
      rpcResults[name] = data;
    },
  });
}
