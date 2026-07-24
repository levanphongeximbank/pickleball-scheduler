/**
 * In-memory Customer repository (CUSTOMER-01 certification / tests).
 * Isolated per factory call. Not production persistence.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { CustomerError } from "../errors/CustomerError.js";
import { createCustomerScope, scopesMatch } from "../domain/scope.js";
import { CONTACT_POINT_TYPE } from "../constants/contactPointTypes.js";
import { CUSTOMER_REPOSITORY_PORTS } from "./ports.js";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function cloneFrozen(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneFrozen(item)));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = cloneFrozen(value[key]);
  }
  return Object.freeze(out);
}

/**
 * @param {string} tenantId
 * @param {string} venueId
 * @param {string} entityId
 */
function scopeKey(tenantId, venueId, entityId) {
  return `${tenantId}\u0000${venueId}\u0000${entityId}`;
}

/**
 * @returns {import("./ports.js").CustomerRepository & {
 *   port: string,
 *   resetAllForTests: () => void,
 * }}
 */
export function createInMemoryCustomerRepository() {
  /** @type {Map<string, object>} */
  const byId = new Map();

  function requireScope(scope) {
    return createCustomerScope(scope);
  }

  function readScoped(scope, customerId) {
    const s = requireScope(scope);
    const key = scopeKey(s.tenantId, s.venueId, customerId);
    const row = byId.get(key);
    if (!row) return null;
    if (!scopesMatch(s, row)) return null;
    return cloneFrozen(row);
  }

  function listScoped(scope) {
    const s = requireScope(scope);
    const rows = [];
    for (const row of byId.values()) {
      if (scopesMatch(s, row)) rows.push(cloneFrozen(row));
    }
    return rows;
  }

  function matchesQuery(row, query = {}) {
    if (query.customerType && row.customerType !== query.customerType) return false;
    if (query.status && row.status !== query.status) return false;
    if (query.customerNumber && row.customerNumber !== query.customerNumber) return false;
    if (query.text) {
      const needle = String(query.text).trim().toLowerCase();
      if (!needle) return true;
      const hay = [
        row.displayName,
        row.legalName,
        row.customerNumber,
        row.customerId,
        row.individualProfile?.givenName,
        row.individualProfile?.familyName,
        row.organizationProfile?.organizationName,
        ...(row.contactPoints || []).map(
          (c) => `${c.value || ""} ${c.displayValue || ""} ${c.normalizedValue || ""}`
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  }

  return {
    port: CUSTOMER_REPOSITORY_PORTS.CustomerRepository,

    getById(scope, customerId) {
      if (!customerId || !String(customerId).trim()) return null;
      return readScoped(scope, String(customerId).trim());
    },

    findByCustomerNumber(scope, customerNumber) {
      if (!customerNumber || !String(customerNumber).trim()) return null;
      const needle = String(customerNumber).trim();
      return listScoped(scope).find((row) => row.customerNumber === needle) || null;
    },

    search(scope, query = {}) {
      const limit = Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
      const offset = Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
      return listScoped(scope)
        .filter((row) => matchesQuery(row, query))
        .slice(offset, offset + limit);
    },

    list(scope, query = {}) {
      const limit = Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
      const offset = Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
      const filtered = listScoped(scope).filter((row) => matchesQuery(row, query));
      return {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
      };
    },

    exists(scope, customerId) {
      return readScoped(scope, customerId) != null;
    },

    findDuplicate(scope, criteria = {}) {
      const rows = listScoped(scope);
      const excludeId = criteria.excludeCustomerId
        ? String(criteria.excludeCustomerId)
        : null;

      if (criteria.customerNumber) {
        const hit = rows.find(
          (row) =>
            row.customerNumber === criteria.customerNumber &&
            row.customerId !== excludeId
        );
        if (hit) return hit;
      }

      if (criteria.primaryEmail) {
        const email = String(criteria.primaryEmail).trim().toLowerCase();
        const hit = rows.find((row) => {
          if (row.customerId === excludeId) return false;
          return (row.contactPoints || []).some(
            (c) =>
              c.type === CONTACT_POINT_TYPE.EMAIL &&
              c.primary === true &&
              (c.normalizedValue || c.value) === email
          );
        });
        if (hit) return hit;
      }

      if (criteria.primaryPhone) {
        const phone = String(criteria.primaryPhone).trim().replace(/\s+/g, "");
        const hit = rows.find((row) => {
          if (row.customerId === excludeId) return false;
          return (row.contactPoints || []).some((c) => {
            if (c.type !== CONTACT_POINT_TYPE.PHONE || c.primary !== true) {
              return false;
            }
            const normalized = String(c.normalizedValue || c.value || "").replace(
              /\s+/g,
              ""
            );
            return normalized === phone;
          });
        });
        if (hit) return hit;
      }

      if (criteria.userAccountId) {
        const hit = rows.find(
          (row) =>
            row.customerId !== excludeId &&
            row.accountLinkage?.userAccountId === criteria.userAccountId
        );
        if (hit) return hit;
      }

      if (criteria.playerId) {
        const hit = rows.find(
          (row) =>
            row.customerId !== excludeId &&
            row.playerLinkage?.playerId === criteria.playerId
        );
        if (hit) return hit;
      }

      return null;
    },

    save(customer) {
      const s = createCustomerScope(customer);
      if (!customer.customerId || !String(customer.customerId).trim()) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.INVALID_REFERENCE,
          "customerId is required to save.",
          { field: "customerId" }
        );
      }
      const key = scopeKey(s.tenantId, s.venueId, customer.customerId);
      const existing = byId.get(key);
      // create starts at version 1 with no existing row; updates must be strictly newer.
      if (existing && customer.version <= existing.version) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
          "Customer version conflict.",
          {
            customerId: customer.customerId,
            expectedVersion: existing.version + 1,
            receivedVersion: customer.version,
          }
        );
      }

      // Uniqueness: customerNumber within scope
      for (const row of byId.values()) {
        if (
          scopesMatch(s, row) &&
          row.customerNumber === customer.customerNumber &&
          row.customerId !== customer.customerId
        ) {
          throw new CustomerError(
            CUSTOMER_ERROR_CODES.DUPLICATE,
            "customerNumber already exists in this scope.",
            {
              customerNumber: customer.customerNumber,
              existingCustomerId: row.customerId,
            }
          );
        }
      }

      const frozen = cloneFrozen(customer);
      byId.set(key, frozen);
      return cloneFrozen(frozen);
    },

    resetAllForTests() {
      byId.clear();
    },

    /**
     * Test/harness only — restore a prior snapshot without version monotonic checks.
     * Used by linkage transactional rollback.
     * @param {object} customer
     */
    _restoreForTests(customer) {
      if (!customer?.customerId) return;
      const s = createCustomerScope(customer);
      const key = scopeKey(s.tenantId, s.venueId, customer.customerId);
      byId.set(key, cloneFrozen(customer));
    },
  };
}
