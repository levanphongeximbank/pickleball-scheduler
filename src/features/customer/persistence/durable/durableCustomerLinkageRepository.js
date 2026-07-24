/**
 * Durable Customer linkage repository (CUSTOMER-05).
 */

import { CUSTOMER_ERROR_CODES } from "../../errors/codes.js";
import { CustomerError } from "../../errors/CustomerError.js";
import { createCustomerScope, scopesMatch } from "../../domain/scope.js";
import { isActiveCustomerLinkageStatus } from "../../constants/linkageStatuses.js";
import { cloneFrozen } from "../../repositories/inMemory.js";
import { CUSTOMER_LINKAGE_REPOSITORY_PORTS } from "../../repositories/linkagePorts.js";
import {
  CUSTOMER_PHASE_5_RPC,
  CUSTOMER_PHASE_5_TABLES,
  requireCustomerDatabaseClientPort,
} from "../databaseClientPort.js";
import { withCustomerPersistenceErrors } from "../errorTranslation.js";
import {
  mapLinkageDomainToRow,
  mapLinkageHistoryDomainToRow,
  mapLinkageHistoryRowToDomain,
  mapLinkageRowToDomain,
} from "../mapping/linkageMapping.js";

/**
 * @param {{ db: import('../databaseClientPort.js').CustomerDatabaseClientPort }} deps
 */
export function createDurableCustomerLinkageRepository(deps = {}) {
  const db = requireCustomerDatabaseClientPort(deps.db);

  function scopeFilters(scope) {
    return { tenant_id: scope.tenantId, venue_id: scope.venueId };
  }

  function assertLinkageVersion(existing, expectedVersion, linkageId) {
    if (expectedVersion == null) return;
    const expected = Number(expectedVersion);
    if (!existing) {
      if (expected !== 0) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
          "Linkage version conflict on create.",
          { linkageId, expectedVersion: expected, actualVersion: 0 }
        );
      }
      return;
    }
    if (!Number.isInteger(expected) || expected !== existing.version) {
      throw new CustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Linkage version conflict.",
        {
          linkageId,
          expectedVersion: expected,
          actualVersion: existing.version,
        }
      );
    }
  }

  return {
    port: CUSTOMER_LINKAGE_REPOSITORY_PORTS.CustomerLinkageRepository,

    async getById(scopeInput, linkageId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_5_TABLES.LINKAGES,
          filters: {
            ...scopeFilters(scope),
            linkage_id: String(linkageId),
          },
          limit: 1,
        });
        if (!rows || rows.length === 0) return null;
        const domain = mapLinkageRowToDomain(rows[0]);
        if (!scopesMatch(scope, domain)) return null;
        return cloneFrozen(domain);
      });
    },

    async listByCustomer(scopeInput, customerId, options = {}) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const filters = {
          ...scopeFilters(scope),
          customer_id: String(customerId),
        };
        if (options.linkageType) {
          filters.linkage_type = String(options.linkageType);
        }
        const rows = await db.select({
          table: CUSTOMER_PHASE_5_TABLES.LINKAGES,
          filters,
          order: [{ column: "linkage_id", ascending: true }],
        });
        return (rows || [])
          .map(mapLinkageRowToDomain)
          .filter((r) => scopesMatch(scope, r))
          .filter(
            (r) =>
              !options.activeOnly || isActiveCustomerLinkageStatus(r.status)
          )
          .map((r) => cloneFrozen(r));
      });
    },

    async findActiveByExternalReference(
      scopeInput,
      linkageType,
      externalReferenceId,
      options = {}
    ) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const filters = {
          ...scopeFilters(scope),
          linkage_type: String(linkageType),
          external_reference_id: String(externalReferenceId),
        };
        if (options.externalSystem) {
          filters.external_system = String(options.externalSystem);
        }
        const rows = await db.select({
          table: CUSTOMER_PHASE_5_TABLES.LINKAGES,
          filters,
          order: [{ column: "updated_at", ascending: false }],
        });
        const mapped = (rows || [])
          .map(mapLinkageRowToDomain)
          .filter((r) => scopesMatch(scope, r));
        if (options.activeOnly === false) {
          return mapped[0] ? cloneFrozen(mapped[0]) : null;
        }
        const active = mapped.find((r) => isActiveCustomerLinkageStatus(r.status));
        return active ? cloneFrozen(active) : null;
      });
    },

    async findActiveByCustomerAndType(
      scopeInput,
      customerId,
      linkageType,
      options = {}
    ) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const filters = {
          ...scopeFilters(scope),
          customer_id: String(customerId),
          linkage_type: String(linkageType),
        };
        if (options.externalSystem) {
          filters.external_system = String(options.externalSystem);
        }
        const rows = await db.select({
          table: CUSTOMER_PHASE_5_TABLES.LINKAGES,
          filters,
          order: [{ column: "updated_at", ascending: false }],
        });
        const mapped = (rows || [])
          .map(mapLinkageRowToDomain)
          .filter((r) => scopesMatch(scope, r));
        if (options.activeOnly === false) {
          return mapped[0] ? cloneFrozen(mapped[0]) : null;
        }
        const active = mapped.find((r) => isActiveCustomerLinkageStatus(r.status));
        return active ? cloneFrozen(active) : null;
      });
    },

    async saveLinkageWithHistory(linkage, history, options = {}) {
      return withCustomerPersistenceErrors(async () => {
        const scope = createCustomerScope(linkage);
        const existingRows = await db.select({
          table: CUSTOMER_PHASE_5_TABLES.LINKAGES,
          filters: {
            ...scopeFilters(scope),
            linkage_id: linkage.linkageId,
          },
          limit: 1,
        });
        const existing = existingRows?.[0]
          ? mapLinkageRowToDomain(existingRows[0])
          : null;
        assertLinkageVersion(
          existing,
          options.expectedLinkageVersion,
          linkage.linkageId
        );

        const saved = await db.rpc({
          fn: CUSTOMER_PHASE_5_RPC.SAVE_LINKAGE,
          args: {
            p_linkage: mapLinkageDomainToRow(linkage),
            p_history: mapLinkageHistoryDomainToRow(history),
            p_expected_linkage_version:
              options.expectedLinkageVersion == null
                ? null
                : Number(options.expectedLinkageVersion),
            p_expected_customer_version:
              options.expectedCustomerVersion == null
                ? null
                : Number(options.expectedCustomerVersion),
            p_customer_version_after:
              options.customerVersionAfter == null
                ? null
                : Number(options.customerVersionAfter),
            p_sync_account_user_id:
              options.clearCustomerAccountUserId
                ? null
                : options.syncCustomerAccountUserId === undefined
                  ? undefined
                  : options.syncCustomerAccountUserId,
            p_clear_account_user_id: Boolean(options.clearCustomerAccountUserId),
            p_sync_player_id:
              options.clearCustomerPlayerId
                ? null
                : options.syncCustomerPlayerId === undefined
                  ? undefined
                  : options.syncCustomerPlayerId,
            p_clear_player_id: Boolean(options.clearCustomerPlayerId),
          },
        });
        return cloneFrozen(mapLinkageRowToDomain(saved));
      });
    },

    async listHistory(scopeInput, linkageId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_5_TABLES.LINKAGE_HISTORY,
          filters: {
            ...scopeFilters(scope),
            linkage_id: String(linkageId),
          },
          order: [{ column: "sequence", ascending: true }],
        });
        return (rows || [])
          .map(mapLinkageHistoryRowToDomain)
          .filter((r) => scopesMatch(scope, r))
          .map((r) => cloneFrozen(r));
      });
    },

    async listHistoryByCustomer(scopeInput, customerId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_5_TABLES.LINKAGE_HISTORY,
          filters: {
            ...scopeFilters(scope),
            customer_id: String(customerId),
          },
          order: [
            { column: "sequence", ascending: true },
            { column: "history_id", ascending: true },
          ],
        });
        return (rows || [])
          .map(mapLinkageHistoryRowToDomain)
          .filter((r) => scopesMatch(scope, r))
          .map((r) => cloneFrozen(r));
      });
    },
  };
}
