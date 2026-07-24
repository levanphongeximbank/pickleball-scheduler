/**
 * In-process durable contract harness (CUSTOMER-03 + CUSTOMER-04 + CUSTOMER-05).
 * Simulates CustomerDatabaseClientPort + save RPCs.
 * NOT a live database. NOT for Production.
 */

import {
  CUSTOMER_PHASE_3_RPC,
  CUSTOMER_PHASE_3_TABLES,
  CUSTOMER_PHASE_4_RPC,
  CUSTOMER_PHASE_4_TABLES,
  CUSTOMER_PHASE_5_RPC,
  CUSTOMER_PHASE_5_TABLES,
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
    [CUSTOMER_PHASE_4_TABLES.CONSENTS, new Map()],
    [CUSTOMER_PHASE_4_TABLES.CONSENT_HISTORY, new Map()],
    [CUSTOMER_PHASE_4_TABLES.PREFERENCES, new Map()],
    [CUSTOMER_PHASE_4_TABLES.PREFERENCE_HISTORY, new Map()],
    [CUSTOMER_PHASE_5_TABLES.LINKAGES, new Map()],
    [CUSTOMER_PHASE_5_TABLES.LINKAGE_HISTORY, new Map()],
  ]);

  function pkFor(table, row) {
    if (table === CUSTOMER_PHASE_3_TABLES.CUSTOMERS) return row.customer_id;
    if (table === CUSTOMER_PHASE_3_TABLES.CONTACT_POINTS) return row.contact_point_id;
    if (table === CUSTOMER_PHASE_3_TABLES.ADDRESSES) return row.address_id;
    if (table === CUSTOMER_PHASE_4_TABLES.CONSENTS) return row.consent_id;
    if (table === CUSTOMER_PHASE_4_TABLES.CONSENT_HISTORY) return row.history_id;
    if (table === CUSTOMER_PHASE_4_TABLES.PREFERENCES) return row.preference_id;
    if (table === CUSTOMER_PHASE_4_TABLES.PREFERENCE_HISTORY) return row.history_id;
    if (table === CUSTOMER_PHASE_5_TABLES.LINKAGES) return row.linkage_id;
    if (table === CUSTOMER_PHASE_5_TABLES.LINKAGE_HISTORY) return row.history_id;
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

      if (table === CUSTOMER_PHASE_5_TABLES.LINKAGES && row.status === "ACTIVE") {
        if (
          existing.status === "ACTIVE" &&
          existing.tenant_id === row.tenant_id &&
          existing.venue_id === row.venue_id &&
          existing.linkage_type === row.linkage_type &&
          existing.external_system === row.external_system &&
          existing.external_reference_id === row.external_reference_id
        ) {
          const err = new Error("duplicate key value violates unique constraint");
          err.code = "23505";
          err.name = "CustomerUniqueViolation";
          throw err;
        }
        if (
          (row.linkage_type === "IDENTITY_ACCOUNT" ||
            row.linkage_type === "PLAYER") &&
          existing.status === "ACTIVE" &&
          existing.tenant_id === row.tenant_id &&
          existing.venue_id === row.venue_id &&
          existing.customer_id === row.customer_id &&
          existing.linkage_type === row.linkage_type
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

  function saveConsent(args = {}) {
    const consent = args.p_consent;
    const history = args.p_history;
    const expectedVersion =
      args.p_expected_version == null ? null : Number(args.p_expected_version);
    if (!consent || !history) {
      const err = new Error("customer_save_consent: consent and history required");
      err.code = "22023";
      throw err;
    }

    const customerStore = tables.get(CUSTOMER_PHASE_3_TABLES.CUSTOMERS);
    const parent = customerStore.get(consent.customer_id);
    if (
      !parent ||
      parent.tenant_id !== consent.tenant_id ||
      parent.venue_id !== consent.venue_id
    ) {
      const err = new Error("customer_save_consent: parent customer missing");
      err.code = "23503";
      throw err;
    }

    const consentStore = tables.get(CUSTOMER_PHASE_4_TABLES.CONSENTS);
    const historyStore = tables.get(CUSTOMER_PHASE_4_TABLES.CONSENT_HISTORY);

    let existing = null;
    for (const row of consentStore.values()) {
      if (
        row.tenant_id === consent.tenant_id &&
        row.venue_id === consent.venue_id &&
        row.customer_id === consent.customer_id &&
        row.purpose === consent.purpose &&
        row.channel === consent.channel
      ) {
        existing = row;
        break;
      }
    }

    if (expectedVersion != null) {
      if (!existing && expectedVersion !== 0) {
        const err = new Error("CUSTOMER_VERSION_CONFLICT");
        err.name = "CustomerVersionConflict";
        err.code = "P0001";
        throw err;
      }
      if (existing && existing.version !== expectedVersion) {
        const err = new Error("CUSTOMER_VERSION_CONFLICT");
        err.name = "CustomerVersionConflict";
        err.code = "P0001";
        throw err;
      }
    }

    // Transactional: snapshot, write history then current, rollback on failure.
    const snapshotConsent = existing ? cloneRow(existing) : null;
    const snapshotHistory = historyStore.has(history.history_id)
      ? cloneRow(historyStore.get(history.history_id))
      : null;

    try {
      if (historyStore.has(history.history_id)) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        throw err;
      }
      historyStore.set(history.history_id, cloneRow(history));
      if (existing) {
        consentStore.delete(existing.consent_id);
      }
      consentStore.set(consent.consent_id, cloneRow(consent));
      return cloneRow(consentStore.get(consent.consent_id));
    } catch (err) {
      if (snapshotHistory) historyStore.set(history.history_id, snapshotHistory);
      else historyStore.delete(history.history_id);
      if (snapshotConsent) {
        consentStore.set(snapshotConsent.consent_id, snapshotConsent);
        if (consent.consent_id !== snapshotConsent.consent_id) {
          consentStore.delete(consent.consent_id);
        }
      } else {
        consentStore.delete(consent.consent_id);
      }
      throw err;
    }
  }

  function savePreference(args = {}) {
    const preference = args.p_preference;
    const history = args.p_history;
    const expectedVersion =
      args.p_expected_version == null ? null : Number(args.p_expected_version);
    if (!preference || !history) {
      const err = new Error(
        "customer_save_preference: preference and history required"
      );
      err.code = "22023";
      throw err;
    }

    const customerStore = tables.get(CUSTOMER_PHASE_3_TABLES.CUSTOMERS);
    const parent = customerStore.get(preference.customer_id);
    if (
      !parent ||
      parent.tenant_id !== preference.tenant_id ||
      parent.venue_id !== preference.venue_id
    ) {
      const err = new Error("customer_save_preference: parent customer missing");
      err.code = "23503";
      throw err;
    }

    const prefStore = tables.get(CUSTOMER_PHASE_4_TABLES.PREFERENCES);
    const historyStore = tables.get(CUSTOMER_PHASE_4_TABLES.PREFERENCE_HISTORY);

    let existing = null;
    for (const row of prefStore.values()) {
      if (
        row.tenant_id === preference.tenant_id &&
        row.venue_id === preference.venue_id &&
        row.customer_id === preference.customer_id &&
        row.purpose === preference.purpose &&
        row.channel === preference.channel
      ) {
        existing = row;
        break;
      }
    }

    if (expectedVersion != null) {
      if (!existing && expectedVersion !== 0) {
        const err = new Error("CUSTOMER_VERSION_CONFLICT");
        err.name = "CustomerVersionConflict";
        err.code = "P0001";
        throw err;
      }
      if (existing && existing.version !== expectedVersion) {
        const err = new Error("CUSTOMER_VERSION_CONFLICT");
        err.name = "CustomerVersionConflict";
        err.code = "P0001";
        throw err;
      }
    }

    if (existing && existing.preference_id !== preference.preference_id) {
      const err = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      err.name = "CustomerUniqueViolation";
      throw err;
    }

    const snapshotPref = existing ? cloneRow(existing) : null;
    const snapshotHistory = historyStore.has(history.history_id)
      ? cloneRow(historyStore.get(history.history_id))
      : null;

    try {
      if (historyStore.has(history.history_id)) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        throw err;
      }
      historyStore.set(history.history_id, cloneRow(history));
      if (existing) {
        prefStore.delete(existing.preference_id);
      }
      prefStore.set(preference.preference_id, cloneRow(preference));
      return cloneRow(prefStore.get(preference.preference_id));
    } catch (err) {
      if (snapshotHistory) historyStore.set(history.history_id, snapshotHistory);
      else historyStore.delete(history.history_id);
      if (snapshotPref) {
        prefStore.set(snapshotPref.preference_id, snapshotPref);
        if (preference.preference_id !== snapshotPref.preference_id) {
          prefStore.delete(preference.preference_id);
        }
      } else {
        prefStore.delete(preference.preference_id);
      }
      throw err;
    }
  }

  function saveLinkage(args = {}) {
    const linkage = args.p_linkage;
    const history = args.p_history;
    const expectedLinkageVersion =
      args.p_expected_linkage_version == null
        ? null
        : Number(args.p_expected_linkage_version);
    const expectedCustomerVersion =
      args.p_expected_customer_version == null
        ? null
        : Number(args.p_expected_customer_version);
    const customerVersionAfter =
      args.p_customer_version_after == null
        ? null
        : Number(args.p_customer_version_after);

    if (!linkage || !history) {
      const err = new Error("customer_save_linkage: linkage and history required");
      err.code = "22023";
      throw err;
    }

    const customerStore = tables.get(CUSTOMER_PHASE_3_TABLES.CUSTOMERS);
    const parent = customerStore.get(linkage.customer_id);
    if (
      !parent ||
      parent.tenant_id !== linkage.tenant_id ||
      parent.venue_id !== linkage.venue_id
    ) {
      const err = new Error("customer_save_linkage: parent customer missing");
      err.code = "23503";
      throw err;
    }

    if (
      expectedCustomerVersion != null &&
      parent.version !== expectedCustomerVersion
    ) {
      const err = new Error("CUSTOMER_VERSION_CONFLICT");
      err.name = "CustomerVersionConflict";
      err.code = "P0001";
      throw err;
    }

    const linkageStore = tables.get(CUSTOMER_PHASE_5_TABLES.LINKAGES);
    const historyStore = tables.get(CUSTOMER_PHASE_5_TABLES.LINKAGE_HISTORY);
    const existing = linkageStore.get(linkage.linkage_id) || null;

    if (expectedLinkageVersion != null) {
      if (!existing && expectedLinkageVersion !== 0) {
        const err = new Error("CUSTOMER_VERSION_CONFLICT");
        err.name = "CustomerVersionConflict";
        err.code = "P0001";
        throw err;
      }
      if (existing && existing.version !== expectedLinkageVersion) {
        const err = new Error("CUSTOMER_VERSION_CONFLICT");
        err.name = "CustomerVersionConflict";
        err.code = "P0001";
        throw err;
      }
    }

    const snapshotLinkage = existing ? cloneRow(existing) : null;
    const snapshotHistory = historyStore.has(history.history_id)
      ? cloneRow(historyStore.get(history.history_id))
      : null;
    const snapshotCustomer = cloneRow(parent);

    try {
      if (historyStore.has(history.history_id)) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        throw err;
      }
      if (args.forceHistoryFailure) {
        throw new Error("forced history failure");
      }
      historyStore.set(history.history_id, cloneRow(history));
      assertUniqueConstraints(
        CUSTOMER_PHASE_5_TABLES.LINKAGES,
        linkage,
        linkage.linkage_id
      );
      linkageStore.set(linkage.linkage_id, cloneRow(linkage));

      const nextCustomer = cloneRow(parent);
      if (customerVersionAfter != null) {
        nextCustomer.version = customerVersionAfter;
      } else {
        nextCustomer.version = parent.version + 1;
      }
      nextCustomer.updated_at = linkage.updated_at;
      if (args.p_clear_account_user_id) {
        nextCustomer.account_user_id = null;
      } else if (args.p_sync_account_user_id !== undefined) {
        nextCustomer.account_user_id = args.p_sync_account_user_id;
      }
      if (args.p_clear_player_id) {
        nextCustomer.player_id = null;
      } else if (args.p_sync_player_id !== undefined) {
        nextCustomer.player_id = args.p_sync_player_id;
      }
      customerStore.set(linkage.customer_id, nextCustomer);

      return cloneRow(linkageStore.get(linkage.linkage_id));
    } catch (err) {
      if (snapshotHistory) historyStore.set(history.history_id, snapshotHistory);
      else historyStore.delete(history.history_id);
      if (snapshotLinkage) {
        linkageStore.set(snapshotLinkage.linkage_id, snapshotLinkage);
        if (linkage.linkage_id !== snapshotLinkage.linkage_id) {
          linkageStore.delete(linkage.linkage_id);
        }
      } else {
        linkageStore.delete(linkage.linkage_id);
      }
      customerStore.set(linkage.customer_id, snapshotCustomer);
      throw err;
    }
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
      if (
        table === CUSTOMER_PHASE_4_TABLES.CONSENT_HISTORY ||
        table === CUSTOMER_PHASE_4_TABLES.PREFERENCE_HISTORY ||
        table === CUSTOMER_PHASE_5_TABLES.LINKAGE_HISTORY
      ) {
        const err = new Error("history tables are append-only");
        err.code = "P0001";
        throw err;
      }
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
      if (
        table === CUSTOMER_PHASE_4_TABLES.CONSENT_HISTORY ||
        table === CUSTOMER_PHASE_4_TABLES.PREFERENCE_HISTORY ||
        table === CUSTOMER_PHASE_5_TABLES.LINKAGE_HISTORY
      ) {
        const err = new Error("history tables are append-only");
        err.code = "P0001";
        throw err;
      }
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
      if (fn === CUSTOMER_PHASE_4_RPC.SAVE_CONSENT) {
        return saveConsent(args);
      }
      if (fn === CUSTOMER_PHASE_4_RPC.SAVE_PREFERENCE) {
        return savePreference(args);
      }
      if (fn === CUSTOMER_PHASE_5_RPC.SAVE_LINKAGE) {
        return saveLinkage(args);
      }
      throw new Error(`Unknown RPC ${fn}`);
    },
  };
}
