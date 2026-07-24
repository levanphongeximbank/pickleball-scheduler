/**
 * Durable CustomerRepository adapter (CUSTOMER-03).
 * Implements CustomerRepository via injectable CustomerDatabaseClientPort.
 * Aggregate writes go through customer_save_aggregate RPC (atomic + versioned).
 */

import { CONTACT_POINT_TYPE } from "../../constants/contactPointTypes.js";
import { CUSTOMER_ERROR_CODES } from "../../errors/codes.js";
import { CustomerError } from "../../errors/CustomerError.js";
import { createCustomerScope, scopesMatch } from "../../domain/scope.js";
import { CUSTOMER_REPOSITORY_PORTS } from "../../repositories/ports.js";
import { cloneFrozen } from "../../repositories/inMemory.js";
import {
  CUSTOMER_PHASE_3_RPC,
  CUSTOMER_PHASE_3_TABLES,
  requireCustomerDatabaseClientPort,
} from "../databaseClientPort.js";
import { withCustomerPersistenceErrors } from "../errorTranslation.js";
import {
  mapCustomerDomainToSavePayload,
  mapCustomerRowsToDomain,
} from "../mapping/customerMapping.js";

/**
 * @param {{ db: import('../databaseClientPort.js').CustomerDatabaseClientPort }} deps
 * @returns {import('../../repositories/ports.js').CustomerRepository & { port: string }}
 */
export function createDurableCustomerRepository(deps = {}) {
  const db = requireCustomerDatabaseClientPort(deps.db);

  function resolveScope(scopeInput) {
    return createCustomerScope(scopeInput);
  }

  function scopeFilters(scope) {
    return { tenant_id: scope.tenantId, venue_id: scope.venueId };
  }

  async function loadAggregate(scope, customerId) {
    const id = String(customerId || "").trim();
    if (!id) return null;

    const roots = await db.select({
      table: CUSTOMER_PHASE_3_TABLES.CUSTOMERS,
      filters: { ...scopeFilters(scope), customer_id: id },
      limit: 1,
    });
    if (!roots || roots.length === 0) return null;
    const root = roots[0];
    if (root.tenant_id !== scope.tenantId || root.venue_id !== scope.venueId) {
      return null;
    }

    const [contacts, addresses] = await Promise.all([
      db.select({
        table: CUSTOMER_PHASE_3_TABLES.CONTACT_POINTS,
        filters: { ...scopeFilters(scope), customer_id: id },
        order: [{ column: "contact_point_id", ascending: true }],
      }),
      db.select({
        table: CUSTOMER_PHASE_3_TABLES.ADDRESSES,
        filters: { ...scopeFilters(scope), customer_id: id },
        order: [{ column: "address_id", ascending: true }],
      }),
    ]);

    return cloneFrozen(mapCustomerRowsToDomain(root, contacts || [], addresses || []));
  }

  function matchesQuery(row, query = {}) {
    if (query.customerType && row.customerType !== query.customerType) return false;
    if (query.status && row.status !== query.status) return false;
    if (query.customerNumber && row.customerNumber !== query.customerNumber) {
      return false;
    }
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

  async function listScoped(scope, query = {}) {
    const roots = await db.select({
      table: CUSTOMER_PHASE_3_TABLES.CUSTOMERS,
      filters: scopeFilters(scope),
      order: [
        { column: "display_name", ascending: true },
        { column: "customer_id", ascending: true },
      ],
    });

    const aggregates = [];
    for (const root of roots || []) {
      const aggregate = await loadAggregate(scope, root.customer_id);
      if (aggregate && matchesQuery(aggregate, query)) {
        aggregates.push(aggregate);
      }
    }
    return aggregates;
  }

  return {
    port: CUSTOMER_REPOSITORY_PORTS.CustomerRepository,

    async getById(scopeInput, customerId) {
      const scope = resolveScope(scopeInput);
      return withCustomerPersistenceErrors(() => loadAggregate(scope, customerId));
    },

    async findByCustomerNumber(scopeInput, customerNumber) {
      const scope = resolveScope(scopeInput);
      const needle = String(customerNumber || "").trim();
      if (!needle) return null;
      return withCustomerPersistenceErrors(async () => {
        const roots = await db.select({
          table: CUSTOMER_PHASE_3_TABLES.CUSTOMERS,
          filters: { ...scopeFilters(scope), customer_number: needle },
          limit: 1,
        });
        if (!roots || roots.length === 0) return null;
        return loadAggregate(scope, roots[0].customer_id);
      });
    },

    async search(scopeInput, query = {}) {
      const scope = resolveScope(scopeInput);
      const limit = Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
      const offset = Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
      return withCustomerPersistenceErrors(async () => {
        const rows = await listScoped(scope, query);
        return rows.slice(offset, offset + limit);
      });
    },

    async list(scopeInput, query = {}) {
      const scope = resolveScope(scopeInput);
      const limit = Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 50;
      const offset = Number.isInteger(query.offset) && query.offset >= 0 ? query.offset : 0;
      return withCustomerPersistenceErrors(async () => {
        const filtered = await listScoped(scope, query);
        return {
          items: filtered.slice(offset, offset + limit),
          total: filtered.length,
          limit,
          offset,
        };
      });
    },

    async exists(scopeInput, customerId) {
      const scope = resolveScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const found = await loadAggregate(scope, customerId);
        return found != null;
      });
    },

    async findDuplicate(scopeInput, criteria = {}) {
      const scope = resolveScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await listScoped(scope, {});
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
      });
    },

    async save(customer) {
      const scope = resolveScope(customer);
      if (!customer?.customerId || !String(customer.customerId).trim()) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.INVALID_REFERENCE,
          "customerId is required to save.",
          { field: "customerId" }
        );
      }
      if (!scopesMatch(scope, customer)) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.TENANT_SCOPE_MISMATCH,
          "Customer save scope mismatch.",
          {
            tenantId: scope.tenantId,
            venueId: scope.venueId,
            customerId: customer.customerId,
          }
        );
      }

      const payload = mapCustomerDomainToSavePayload(customer);

      return withCustomerPersistenceErrors(
        async () => {
          await db.rpc({
            fn: CUSTOMER_PHASE_3_RPC.SAVE_AGGREGATE,
            args: {
              p_customer: payload.customer,
              p_contact_points: payload.contactPoints,
              p_addresses: payload.addresses,
            },
          });
          const saved = await loadAggregate(scope, customer.customerId);
          if (!saved) {
            throw new CustomerError(
              CUSTOMER_ERROR_CODES.NOT_FOUND,
              "Customer save did not persist a readable aggregate.",
              { customerId: customer.customerId }
            );
          }
          return saved;
        },
        {
          conflictMessage: "Customer number or contact uniqueness conflict.",
        }
      );
    },
  };
}
