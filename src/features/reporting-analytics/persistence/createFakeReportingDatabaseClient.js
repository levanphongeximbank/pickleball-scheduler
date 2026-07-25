/**
 * In-process ReportingDatabaseClientPort harness. Not production storage.
 */

import { REPORTING_02_TABLES } from "./databaseClientPort.js";

export function createFakeReportingDatabaseClient() {
  const tables = new Map(
    Object.values(REPORTING_02_TABLES).map((table) => [table, new Map()])
  );
  const primaryKeys = Object.freeze({
    [REPORTING_02_TABLES.REPORT_DEFINITIONS]: "report_definition_id",
    [REPORTING_02_TABLES.SAVED_REPORTS]: "saved_report_id",
    [REPORTING_02_TABLES.SAVED_FILTERS]: "saved_filter_id",
    [REPORTING_02_TABLES.EXECUTIONS]: "execution_id",
    [REPORTING_02_TABLES.EXPORT_JOBS]: "export_job_id",
  });
  const clone = (value) => structuredClone(value);
  const matches = (row, filters = {}) =>
    Object.entries(filters).every(([key, value]) => row[key] === value);
  const primaryKey = (table, row) => row[primaryKeys[table]];

  function unique(table, row, excludedId = null) {
    if (
      table !== REPORTING_02_TABLES.EXECUTIONS &&
      table !== REPORTING_02_TABLES.EXPORT_JOBS
    ) return;
    for (const existing of tables.get(table).values()) {
      if (primaryKey(table, existing) === excludedId) continue;
      if (
        existing.tenant_id === row.tenant_id &&
        existing.idempotency_key === row.idempotency_key
      ) {
        const error = new Error("duplicate idempotency key");
        error.code = "23505";
        throw error;
      }
    }
  }

  return {
    _tables: tables,
    resetAllForTests() {
      for (const table of tables.values()) table.clear();
    },
    async select({ table, filters = {}, order = [], limit }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      let rows = [...store.values()].filter((row) => matches(row, filters)).map(clone);
      rows.sort((a, b) => {
        for (const rule of order) {
          const compare = String(a[rule.column] ?? "").localeCompare(String(b[rule.column] ?? ""));
          if (compare) return rule.ascending === false ? -compare : compare;
        }
        return 0;
      });
      return limit == null ? rows : rows.slice(0, limit);
    },
    async insert({ table, rows, returning = true }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      const values = Array.isArray(rows) ? rows : [rows];
      for (const row of values) {
        if (store.has(primaryKey(table, row))) {
          const error = new Error("duplicate key value violates unique constraint");
          error.code = "23505";
          throw error;
        }
        unique(table, row);
      }
      const saved = values.map((row) => {
        const copied = clone(row);
        store.set(primaryKey(table, copied), copied);
        return clone(copied);
      });
      return returning ? saved : [];
    },
    async update({ table, values, filters = {}, returning = true }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      const updated = [];
      for (const [id, row] of store.entries()) {
        if (!matches(row, filters)) continue;
        const next = { ...row, ...clone(values) };
        unique(table, next, id);
        store.set(id, clone(next));
        updated.push(clone(next));
      }
      return returning ? updated : [];
    },
    async delete({ table, filters = {} }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      let count = 0;
      for (const [id, row] of [...store.entries()]) {
        if (!matches(row, filters)) continue;
        store.delete(id);
        count += 1;
      }
      return count;
    },
    async rpc({ fn }) {
      throw new Error(`Unknown RPC ${fn}`);
    },
  };
}
