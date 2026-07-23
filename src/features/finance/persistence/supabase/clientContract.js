/**
 * Minimal Supabase-compatible client contract for Finance durable adapter (Phase 1G).
 *
 * Required capability: from(table) → chainable builder with:
 *   select, insert, update, eq, neq, is, in, gte, lte, order, limit,
 *   maybeSingle, single, then (thenable)
 *
 * No global singleton. No env access. No network in tests.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import { FINANCE_TABLE_NAME_VALUES, FORBIDDEN_BILLING_TABLES } from "./schema.js";

/**
 * @param {unknown} client
 * @returns {object}
 */
export function assertSupabaseFinanceClient(client) {
  if (client == null || typeof client !== "object") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      "Finance Supabase adapter requires an explicitly injected client.",
      { field: "client" }
    );
  }
  if (typeof /** @type {{ from?: unknown }} */ (client).from !== "function") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      "Injected Finance client must expose from(table).",
      { field: "client.from" }
    );
  }
  return client;
}

/**
 * @param {string} table
 */
export function assertFinanceTableName(table) {
  if (!FINANCE_TABLE_NAME_VALUES.includes(table)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      `Refusing non-Finance table: ${table}`,
      { table }
    );
  }
  if (FORBIDDEN_BILLING_TABLES.includes(table)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED,
      `Refusing Billing table from Finance adapter: ${table}`,
      { table }
    );
  }
  return table;
}

/**
 * Deterministic fake Supabase client for Finance adapter tests only.
 * Isolated per factory call. No network. No credentials.
 *
 * @param {{ seed?: Record<string, object[]>, errors?: Record<string, object> }} [options]
 */
export function createFakeSupabaseFinanceClient(options = {}) {
  /** @type {Map<string, object[]>} */
  const store = new Map();
  for (const table of FINANCE_TABLE_NAME_VALUES) {
    store.set(table, []);
  }
  if (options.seed && typeof options.seed === "object") {
    for (const [table, rows] of Object.entries(options.seed)) {
      assertFinanceTableName(table);
      store.set(table, Array.isArray(rows) ? rows.map((r) => ({ ...r })) : []);
    }
  }

  /** @type {object[]} */
  const calls = [];
  /** @type {Record<string, object>} */
  const scriptedErrors = { ...(options.errors || {}) };

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

  function uniqueConflict(table, row) {
    const rows = store.get(table) || [];
    if (rows.some((r) => r.id === row.id && r.tenant_id === row.tenant_id)) {
      return {
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: `${table}_tenant_id_id_key`,
      };
    }
    if (table === "finance_idempotency") {
      const hit = rows.find(
        (r) =>
          r.tenant_id === row.tenant_id &&
          r.operation_type === row.operation_type &&
          r.idempotency_key === row.idempotency_key
      );
      if (hit) {
        return {
          code: "23505",
          message: "duplicate key value violates unique constraint",
          details: "finance_idempotency_tenant_op_key_uidx",
        };
      }
    }
    if (
      (table === "finance_payments" || table === "finance_payment_attempts") &&
      row.provider_transaction_reference != null
    ) {
      const hit = rows.find(
        (r) =>
          r.tenant_id === row.tenant_id &&
          r.provider_code === row.provider_code &&
          r.provider_transaction_reference === row.provider_transaction_reference
      );
      if (hit) {
        return {
          code: "23505",
          message: "duplicate key value violates unique constraint",
          details: "provider_transaction_reference",
        };
      }
    }
    if (table === "finance_receipts") {
      const hit = rows.find(
        (r) => r.tenant_id === row.tenant_id && r.payment_id === row.payment_id
      );
      if (hit) {
        return {
          code: "23505",
          message: "duplicate key value violates unique constraint",
          details: "finance_receipts_tenant_payment_uidx",
        };
      }
    }
    if (table === "finance_events") {
      const hit = rows.find((r) => r.id === row.id);
      if (hit) {
        return {
          code: "23505",
          message: "duplicate key value violates unique constraint",
          details: "finance_events_pkey",
        };
      }
    }
    return null;
  }

  function createBuilder(table) {
    assertFinanceTableName(table);
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
        if (state.type === "insert" || state.type === "update") {
          // postgrest returning
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
      update(payload) {
        state.type = "update";
        state.payload = payload;
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
      const call = {
        table,
        type: state.type,
        filters: state.filters.map((f) => ({ ...f })),
        payload: state.payload == null ? null : cloneRow(state.payload),
        order: state.order,
        limit: state.limit,
        want: state.want,
      };
      calls.push(call);

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

      // select
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
    /** @returns {ReadonlyArray<object>} */
    getCalls() {
      return Object.freeze(calls.map((c) => Object.freeze({ ...c, filters: Object.freeze([...c.filters]) })));
    },
    clearCalls() {
      calls.length = 0;
    },
    /** @param {string} table */
    getRows(table) {
      assertFinanceTableName(table);
      return Object.freeze((store.get(table) || []).map(cloneRow));
    },
    /** @param {string} table @param {object} row */
    seedRow(table, row) {
      assertFinanceTableName(table);
      const rows = store.get(table) || [];
      rows.push(cloneRow(row));
      store.set(table, rows);
    },
    /** @param {string} key @param {object} error */
    setError(key, error) {
      scriptedErrors[key] = error;
    },
    clearErrors() {
      for (const key of Object.keys(scriptedErrors)) delete scriptedErrors[key];
    },
    resetAll() {
      for (const table of FINANCE_TABLE_NAME_VALUES) store.set(table, []);
      calls.length = 0;
      for (const key of Object.keys(scriptedErrors)) delete scriptedErrors[key];
    },
  });
}
