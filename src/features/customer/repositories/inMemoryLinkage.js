/**
 * In-memory Customer linkage repository (CUSTOMER-05).
 * Transactional current-state + history + optional Customer aggregate sync.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { CustomerError } from "../errors/CustomerError.js";
import { createCustomerScope, scopesMatch } from "../domain/scope.js";
import { isActiveCustomerLinkageStatus } from "../constants/linkageStatuses.js";
import { cloneFrozen } from "./inMemory.js";
import { CUSTOMER_LINKAGE_REPOSITORY_PORTS } from "./linkagePorts.js";

/**
 * @param {{ customerRepository?: object|null }} [deps]
 */
export function createInMemoryCustomerLinkageRepository(deps = {}) {
  const customerRepository = deps.customerRepository ?? null;
  /** @type {Map<string, object>} */
  const linkages = new Map();
  /** @type {Map<string, object[]>} */
  const historyByLinkage = new Map();

  function linkageMapKey(linkageId) {
    return String(linkageId);
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

  function assertActiveUniqueness(next, excludingLinkageId = null) {
    if (!isActiveCustomerLinkageStatus(next.status)) return;
    for (const row of linkages.values()) {
      if (excludingLinkageId && row.linkageId === excludingLinkageId) continue;
      if (!scopesMatch(next, row)) continue;
      if (!isActiveCustomerLinkageStatus(row.status)) continue;

      if (
        (next.linkageType === "IDENTITY_ACCOUNT" ||
          next.linkageType === "PLAYER") &&
        row.linkageType === next.linkageType &&
        row.customerId === next.customerId
      ) {
        throw new CustomerError(
          next.linkageType === "IDENTITY_ACCOUNT"
            ? CUSTOMER_ERROR_CODES.IDENTITY_LINK_CONFLICT
            : CUSTOMER_ERROR_CODES.PLAYER_LINK_CONFLICT,
          "Customer already has an active linkage of this type.",
          {
            customerId: next.customerId,
            linkageType: next.linkageType,
            existingLinkageId: row.linkageId,
          }
        );
      }

      if (
        row.linkageType === next.linkageType &&
        row.externalReferenceId === next.externalReferenceId &&
        row.externalSystem === next.externalSystem
      ) {
        const code =
          next.linkageType === "IDENTITY_ACCOUNT"
            ? CUSTOMER_ERROR_CODES.IDENTITY_LINK_CONFLICT
            : next.linkageType === "PLAYER"
              ? CUSTOMER_ERROR_CODES.PLAYER_LINK_CONFLICT
              : CUSTOMER_ERROR_CODES.CRM_LINK_CONFLICT;
        throw new CustomerError(
          code,
          "External reference is already linked to another Customer in this scope.",
          {
            linkageType: next.linkageType,
            externalReferenceId: next.externalReferenceId,
            existingCustomerId: row.customerId,
            requestedCustomerId: next.customerId,
          }
        );
      }
    }
  }

  async function syncCustomerAggregate(linkage, options = {}) {
    if (!customerRepository) return;
    const scope = createCustomerScope(linkage);
    const customer = await customerRepository.getById(scope, linkage.customerId);
    if (!customer) {
      throw new CustomerError(
        CUSTOMER_ERROR_CODES.NOT_FOUND,
        "Customer not found for linkage sync.",
        { customerId: linkage.customerId }
      );
    }
    if (
      options.expectedCustomerVersion != null &&
      Number(options.expectedCustomerVersion) !== customer.version
    ) {
      throw new CustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Customer version conflict.",
        {
          customerId: customer.customerId,
          expectedVersion: Number(options.expectedCustomerVersion),
          actualVersion: customer.version,
        }
      );
    }

    const nextVersion =
      options.customerVersionAfter != null
        ? Number(options.customerVersionAfter)
        : customer.version + 1;

    let accountLinkage = customer.accountLinkage ?? null;
    let playerLinkage = customer.playerLinkage ?? null;

    if (options.clearCustomerAccountUserId) {
      accountLinkage = null;
    } else if (options.syncCustomerAccountUserId !== undefined) {
      accountLinkage = options.syncCustomerAccountUserId
        ? Object.freeze({ userAccountId: options.syncCustomerAccountUserId })
        : null;
    }

    if (options.clearCustomerPlayerId) {
      playerLinkage = null;
    } else if (options.syncCustomerPlayerId !== undefined) {
      playerLinkage = options.syncCustomerPlayerId
        ? Object.freeze({ playerId: options.syncCustomerPlayerId })
        : null;
    }

    await customerRepository.save(
      Object.freeze({
        ...customer,
        accountLinkage,
        playerLinkage,
        contactPoints: Object.freeze([...(customer.contactPoints || [])]),
        addresses: Object.freeze([...(customer.addresses || [])]),
        version: nextVersion,
        updatedAt: linkage.updatedAt,
      })
    );
  }

  return {
    port: CUSTOMER_LINKAGE_REPOSITORY_PORTS.CustomerLinkageRepository,

    resetAllForTests() {
      linkages.clear();
      historyByLinkage.clear();
    },

    async getById(scopeInput, linkageId) {
      const scope = createCustomerScope(scopeInput);
      const row = linkages.get(linkageMapKey(linkageId));
      if (!row || !scopesMatch(scope, row)) return null;
      return cloneFrozen(row);
    },

    async listByCustomer(scopeInput, customerId, options = {}) {
      const scope = createCustomerScope(scopeInput);
      const out = [];
      for (const row of linkages.values()) {
        if (!scopesMatch(scope, row)) continue;
        if (row.customerId !== customerId) continue;
        if (options.activeOnly && !isActiveCustomerLinkageStatus(row.status)) {
          continue;
        }
        if (options.linkageType && row.linkageType !== options.linkageType) {
          continue;
        }
        out.push(cloneFrozen(row));
      }
      out.sort((a, b) => String(a.linkageId).localeCompare(String(b.linkageId)));
      return out;
    },

    async findActiveByExternalReference(
      scopeInput,
      linkageType,
      externalReferenceId,
      options = {}
    ) {
      const scope = createCustomerScope(scopeInput);
      const system = options.externalSystem || null;
      for (const row of linkages.values()) {
        if (!scopesMatch(scope, row)) continue;
        if (row.linkageType !== linkageType) continue;
        if (row.externalReferenceId !== externalReferenceId) continue;
        if (system && row.externalSystem !== system) continue;
        if (options.activeOnly === false) {
          return cloneFrozen(row);
        }
        if (isActiveCustomerLinkageStatus(row.status)) {
          return cloneFrozen(row);
        }
      }
      return null;
    },

    async findActiveByCustomerAndType(
      scopeInput,
      customerId,
      linkageType,
      options = {}
    ) {
      const scope = createCustomerScope(scopeInput);
      const system = options.externalSystem || null;
      for (const row of linkages.values()) {
        if (!scopesMatch(scope, row)) continue;
        if (row.customerId !== customerId) continue;
        if (row.linkageType !== linkageType) continue;
        if (system && row.externalSystem !== system) continue;
        if (options.activeOnly === false) {
          return cloneFrozen(row);
        }
        if (isActiveCustomerLinkageStatus(row.status)) {
          return cloneFrozen(row);
        }
      }
      return null;
    },

    async saveLinkageWithHistory(linkage, history, options = {}) {
      const scope = createCustomerScope(linkage);
      const key = linkageMapKey(linkage.linkageId);
      const existing = linkages.get(key) || null;
      assertLinkageVersion(existing, options.expectedLinkageVersion, linkage.linkageId);
      assertActiveUniqueness(linkage, linkage.linkageId);

      const prevHistory = historyByLinkage.get(key)
        ? [...historyByLinkage.get(key)]
        : [];
      const prevLinkage = existing ? cloneFrozen(existing) : null;
      let customerSnapshot = null;
      if (customerRepository) {
        customerSnapshot = await customerRepository.getById(
          scope,
          linkage.customerId
        );
      }

      try {
        if (options.forceHistoryFailure) {
          throw new Error("forced history failure");
        }
        historyByLinkage.set(key, [...prevHistory, cloneFrozen(history)]);
        linkages.set(key, cloneFrozen(linkage));
        await syncCustomerAggregate(linkage, options);
        return cloneFrozen(linkage);
      } catch (err) {
        if (prevLinkage) linkages.set(key, prevLinkage);
        else linkages.delete(key);
        if (prevHistory.length) historyByLinkage.set(key, prevHistory);
        else historyByLinkage.delete(key);
        if (
          customerRepository &&
          customerSnapshot &&
          typeof customerRepository._restoreForTests === "function"
        ) {
          customerRepository._restoreForTests(customerSnapshot);
        }
        throw err;
      }
    },

    async listHistory(scopeInput, linkageId) {
      const scope = createCustomerScope(scopeInput);
      const linkage = linkages.get(linkageMapKey(linkageId));
      if (linkage && !scopesMatch(scope, linkage)) return [];
      const rows = historyByLinkage.get(linkageMapKey(linkageId)) || [];
      return rows
        .filter((row) => scopesMatch(scope, row))
        .map((row) => cloneFrozen(row));
    },

    async listHistoryByCustomer(scopeInput, customerId) {
      const scope = createCustomerScope(scopeInput);
      const out = [];
      for (const rows of historyByLinkage.values()) {
        for (const row of rows) {
          if (scopesMatch(scope, row) && row.customerId === customerId) {
            out.push(cloneFrozen(row));
          }
        }
      }
      out.sort((a, b) => {
        const seq = a.sequence - b.sequence;
        if (seq !== 0) return seq;
        return String(a.historyId).localeCompare(String(b.historyId));
      });
      return out;
    },
  };
}
