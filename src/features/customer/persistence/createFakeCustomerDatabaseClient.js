/**
 * In-process durable contract harness (CUSTOMER-03).
 * Simulates CustomerDatabaseClientPort + customer_save_aggregate semantics.
 * NOT a live database. NOT for Production.
 */

import {
  CUSTOMER_PHASE_3_RPC,
  CUSTOMER_PHASE_3_TABLES,
} from "./databaseClientPort.js";

/**
 * @returns {import('./databaseClientPort.js').CustomerDatabaseClientPort & {
 *   resetAllForTests: () => void,
 *   _tables: Map<string, Map<string, object>>,
 * }}
 */
export function createFakeCustomerDatabaseClient() {
  /** @type {Map<string, Map<string, object>>} */
  const tables = new Map([
    [CUSTOMER_PHASE_3_TABLES.CUSTOMERS, new Map()],
    [CUSTOMER_PHASE_3_TABLES.CONTACT_POINTS, new Map()],
    [CUSTOMER_PHASE_3_TABLES.ADDRESSES, new Map()],
  ]);

  function pkFor(table, row) {
    if (table === CUSTOMER_PHASE_3_TABLES.CUSTOMERS) return row.customer_id;
    if (table === CUSTOMER_PHASE_3_TABLES.CONTACT_POINTS) return row.contact_point_id;
    if (table === CUSTOMER_PHASE_3_TABLES.ADDRESSES) return row.address_id;
    throw new Error(`Unknown table ${table}`);
  }

  function cloneRow(row) {
    return JSON.parse(JSON.stringify(row));
  }

  function matches(row, filters = {}) {
    for (const [key, value] of Object.entries(filters || {})) {
      if (row[key] !== value) return false;
    }
    return true;
  }

  function sortRows(rows, order = []) {
    const copy = rows.slice();
    copy.sort((a, b) => {
      for (const rule of order) {
        const av = a[rule.column];
        const bv = b[rule.column];
        const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        if (cmp !== 0) return rule.ascending === false ? -cmp : cmp;
      }
      return 0;
    });
    return copy;
  }

  function assertUniqueConstraints(table, row, excludingPk = null) {
    const store = tables.get(table);
    for (const existing of store.values()) {
      const existingPk = pkFor(table, existing);
      if (excludingPk != null && existingPk === excludingPk) continue;

      if (table === CUSTOMER_PHASE_3_TABLES.CUSTOMERS) {
        if (
          existing.tenant_id === row.tenant_id &&
          existing.venue_id === row.venue_id &&
          existing.customer_number === row.customer_number
        ) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          err.name = "CustomerUniqueViolation";
          throw err;
        }
      }

      if (table === CUSTOMER_PHASE_3_TABLES.CONTACT_POINTS) {
        if (
          row.status === "ACTIVE" &&
          existing.status === "ACTIVE" &&
          existing.customer_id === row.customer_id &&
          existing.contact_type === row.contact_type &&
          existing.normalized_value === row.normalized_value
        ) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          err.name = "CustomerUniqueViolation";
          throw err;
        }
        if (
          row.is_primary === true &&
          row.status === "ACTIVE" &&
          existing.is_primary === true &&
          existing.status === "ACTIVE" &&
          existing.customer_id === row.customer_id &&
          existing.contact_type === row.contact_type
        ) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          err.name = "CustomerUniqueViolation";
          throw err;
        }
      }

      if (table === CUSTOMER_PHASE_3_TABLES.ADDRESSES) {
        if (
          row.is_primary === true &&
          row.status === "ACTIVE" &&
          existing.is_primary === true &&
          existing.status === "ACTIVE" &&
          existing.customer_id === row.customer_id
        ) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          err.name = "CustomerUniqueViolation";
          throw err;
        }
      }
    }
  }

  function saveAggregate(args = {}) {
    const customer = args.p_customer;
    const contacts = Array.isArray(args.p_contact_points) ? args.p_contact_points : [];
    const addresses = Array.isArray(args.p_addresses) ? args.p_addresses : [];

    if (!customer || typeof customer !== "object") {
      const err = new Error("customer_save_aggregate: customer payload required");
      err.code = "22023";
      throw err;
    }

    const customerId = String(customer.customer_id || "").trim();
    const tenantId = String(customer.tenant_id || "").trim();
    const venueId = String(customer.venue_id || "").trim();
    const version = Number(customer.version);

    if (!customerId || !tenantId || !venueId) {
      const err = new Error(
        "customer_save_aggregate: customer_id, tenant_id, venue_id required"
      );
      err.code = "22023";
      throw err;
    }
    if (!Number.isInteger(version) || version < 1) {
      const err = new Error("customer_save_aggregate: version must be >= 1");
      err.code = "22023";
      throw err;
    }

    for (const cp of contacts) {
      if (
        cp.tenant_id !== tenantId ||
        cp.venue_id !== venueId ||
        cp.customer_id !== customerId
      ) {
        const err = new Error("customer_save_aggregate: contact scope mismatch");
        err.code = "23514";
        throw err;
      }
    }
    for (const addr of addresses) {
      if (
        addr.tenant_id !== tenantId ||
        addr.venue_id !== venueId ||
        addr.customer_id !== customerId
      ) {
        const err = new Error("customer_save_aggregate: address scope mismatch");
        err.code = "23514";
        throw err;
      }
    }

    const customerStore = tables.get(CUSTOMER_PHASE_3_TABLES.CUSTOMERS);
    const contactStore = tables.get(CUSTOMER_PHASE_3_TABLES.CONTACT_POINTS);
    const addressStore = tables.get(CUSTOMER_PHASE_3_TABLES.ADDRESSES);
    const existing = customerStore.get(customerId);

    if (!existing) {
      if (version !== 1) {
        const err = new Error("CUSTOMER_VERSION_CONFLICT");
        err.name = "CustomerVersionConflict";
        err.code = "P0001";
        throw err;
      }
      assertUniqueConstraints(CUSTOMER_PHASE_3_TABLES.CUSTOMERS, customer);
      customerStore.set(customerId, cloneRow(customer));
    } else {
      if (
        existing.tenant_id !== tenantId ||
        existing.venue_id !== venueId
      ) {
        const err = new Error("customer_save_aggregate: scope mismatch");
        err.code = "23514";
        throw err;
      }
      const expectedPrevious = version - 1;
      if (existing.version !== expectedPrevious) {
        const err = new Error("CUSTOMER_VERSION_CONFLICT");
        err.name = "CustomerVersionConflict";
        err.code = "P0001";
        err.detail = `expected_previous=${expectedPrevious} actual=${existing.version}`;
        throw err;
      }
      assertUniqueConstraints(CUSTOMER_PHASE_3_TABLES.CUSTOMERS, customer, customerId);
      customerStore.set(customerId, cloneRow({ ...existing, ...customer, version }));

      for (const [pk, row] of [...contactStore.entries()]) {
        if (
          row.tenant_id === tenantId &&
          row.venue_id === venueId &&
          row.customer_id === customerId
        ) {
          contactStore.delete(pk);
        }
      }
      for (const [pk, row] of [...addressStore.entries()]) {
        if (
          row.tenant_id === tenantId &&
          row.venue_id === venueId &&
          row.customer_id === customerId
        ) {
          addressStore.delete(pk);
        }
      }
    }

    for (const cp of contacts) {
      assertUniqueConstraints(CUSTOMER_PHASE_3_TABLES.CONTACT_POINTS, cp);
      contactStore.set(cp.contact_point_id, cloneRow(cp));
    }
    for (const addr of addresses) {
      assertUniqueConstraints(CUSTOMER_PHASE_3_TABLES.ADDRESSES, addr);
      addressStore.set(addr.address_id, cloneRow(addr));
    }

    return cloneRow(customerStore.get(customerId));
  }

  return {
    _tables: tables,

    resetAllForTests() {
      for (const store of tables.values()) store.clear();
    },

    async select({ table, filters, order, limit }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      let rows = [...store.values()].filter((row) => matches(row, filters)).map(cloneRow);
      rows = sortRows(rows, order);
      if (limit != null) rows = rows.slice(0, limit);
      return rows;
    },

    async insert({ table, rows, returning = true }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      const list = Array.isArray(rows) ? rows : [rows];
      for (const row of list) {
        const pk = pkFor(table, row);
        if (store.has(pk)) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          throw err;
        }
        assertUniqueConstraints(table, row);
      }
      const inserted = [];
      for (const row of list) {
        const saved = cloneRow(row);
        store.set(pkFor(table, saved), saved);
        inserted.push(cloneRow(saved));
      }
      return returning ? inserted : [];
    },

    async update({ table, values, filters, returning = true }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      const updated = [];
      for (const [pk, row] of store.entries()) {
        if (!matches(row, filters)) continue;
        const next = { ...row, ...values };
        assertUniqueConstraints(table, next, pk);
        store.set(pk, cloneRow(next));
        updated.push(cloneRow(next));
      }
      return returning ? updated : [];
    },

    async delete({ table, filters }) {
      const store = tables.get(table);
      if (!store) throw new Error(`Unknown table ${table}`);
      let count = 0;
      for (const [pk, row] of [...store.entries()]) {
        if (!matches(row, filters)) continue;
        store.delete(pk);
        count += 1;
      }
      return count;
    },

    async rpc({ fn, args = {} }) {
      if (fn === CUSTOMER_PHASE_3_RPC.SAVE_AGGREGATE) {
        return saveAggregate(args);
      }
      throw new Error(`Unknown RPC ${fn}`);
    },
  };
}
