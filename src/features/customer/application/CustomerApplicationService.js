/**
 * Customer Application Service (CUSTOMER-01).
 * Fail-closed when repository adapter is not configured.
 */

import { CONTACT_POINT_TYPE } from "../constants/contactPointTypes.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import {
  addCustomerContactPoint,
  changeCustomerStatus,
  createCustomerProfile,
  removeCustomerContactPoint,
  setCustomerLinkage,
  updateCustomerContactPoint,
  updateCustomerProfileFields,
} from "../domain/customerProfile.js";
import { createCustomerScope } from "../domain/scope.js";
import {
  createSequentialCustomerIdGenerator,
  createSystemCustomerClock,
} from "../repositories/ports.js";
import {
  projectCustomerDetails,
  projectCustomerSummary,
} from "../projectors/customerSummary.js";

/**
 * @param {object} [deps]
 * @param {import("../repositories/ports.js").CustomerRepository|null} [deps.repository]
 * @param {import("../repositories/ports.js").CustomerClock} [deps.clock]
 * @param {import("../repositories/ports.js").CustomerIdGenerator} [deps.idGenerator]
 */
export function createCustomerApplicationService(deps = {}) {
  const repository = deps.repository ?? null;
  const clock = deps.clock || createSystemCustomerClock();
  const idGenerator = deps.idGenerator || createSequentialCustomerIdGenerator();

  function requireRepository() {
    if (!repository) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        "Customer Management runtime adapter is not configured.",
        { adapter: "CustomerRepository" }
      );
    }
    return repository;
  }

  function domainDeps() {
    return {
      nowIso: () => clock.nowIso(),
      nextId: (prefix) => idGenerator.nextId(prefix),
    };
  }

  async function loadRequired(scope, customerId) {
    const repo = requireRepository();
    const s = createCustomerScope(scope);
    const found = await repo.getById(s, customerId);
    if (!found) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.NOT_FOUND,
        "Customer not found.",
        { customerId, tenantId: s.tenantId, venueId: s.venueId }
      );
    }
    return { repo, scope: s, customer: found };
  }

  function primaryOfType(contactPoints, type) {
    return (contactPoints || []).find((c) => c.primary && c.type === type) || null;
  }

  async function assertNoDuplicate(repo, scope, customer, excludeCustomerId = null) {
    const primaryEmail = primaryOfType(customer.contactPoints, CONTACT_POINT_TYPE.EMAIL);
    const primaryPhone = primaryOfType(customer.contactPoints, CONTACT_POINT_TYPE.PHONE);
    const duplicate = await repo.findDuplicate(scope, {
      excludeCustomerId,
      customerNumber: customer.customerNumber,
      primaryEmail: primaryEmail?.value,
      primaryPhone: primaryPhone?.value,
      userAccountId: customer.accountLinkage?.userAccountId,
      playerId: customer.playerLinkage?.playerId,
    });
    if (duplicate) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.DUPLICATE,
        "Duplicate customer detected.",
        {
          customerId: duplicate.customerId,
          conflictingCustomerNumber: duplicate.customerNumber,
        }
      );
    }
  }

  return Object.freeze({
    /**
     * @param {object} input
     */
    async createCustomer(input = {}) {
      const repo = requireRepository();
      const scope = createCustomerScope(input);
      const customer = createCustomerProfile(input, domainDeps());
      await assertNoDuplicate(repo, scope, customer);
      const saved = await repo.save(customer);
      return projectCustomerDetails(saved);
    },

    async getCustomer(scope, customerId) {
      const { customer } = await loadRequired(scope, customerId);
      return projectCustomerDetails(customer);
    },

    async updateCustomerProfile(scope, customerId, patch = {}) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      const updated = updateCustomerProfileFields(customer, patch, domainDeps());
      await assertNoDuplicate(repo, s, updated, customer.customerId);
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async changeStatus(scope, customerId, nextStatus) {
      const { repo, customer } = await loadRequired(scope, customerId);
      const updated = changeCustomerStatus(customer, nextStatus, domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async addContactPoint(scope, customerId, contactInput) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      const updated = addCustomerContactPoint(customer, contactInput, domainDeps());
      await assertNoDuplicate(repo, s, updated, customer.customerId);
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async updateContactPoint(scope, customerId, contactPointId, patch) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      const updated = updateCustomerContactPoint(
        customer,
        contactPointId,
        patch,
        domainDeps()
      );
      await assertNoDuplicate(repo, s, updated, customer.customerId);
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async removeContactPoint(scope, customerId, contactPointId) {
      const { repo, customer } = await loadRequired(scope, customerId);
      const updated = removeCustomerContactPoint(customer, contactPointId, domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async linkUserAccount(scope, customerId, userAccountId) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      const updated = setCustomerLinkage(
        customer,
        { userAccountId },
        "account",
        domainDeps()
      );
      await assertNoDuplicate(repo, s, updated, customer.customerId);
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async unlinkUserAccount(scope, customerId) {
      const { repo, customer } = await loadRequired(scope, customerId);
      const updated = setCustomerLinkage(customer, null, "account", domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async linkPlayer(scope, customerId, playerId) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      const updated = setCustomerLinkage(customer, { playerId }, "player", domainDeps());
      await assertNoDuplicate(repo, s, updated, customer.customerId);
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async unlinkPlayer(scope, customerId) {
      const { repo, customer } = await loadRequired(scope, customerId);
      const updated = setCustomerLinkage(customer, null, "player", domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async linkOrganization(scope, customerId, organizationId) {
      const { repo, customer } = await loadRequired(scope, customerId);
      const updated = setCustomerLinkage(
        customer,
        { organizationId },
        "organization",
        domainDeps()
      );
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async searchCustomers(scope, query = {}) {
      const repo = requireRepository();
      const s = createCustomerScope(scope);
      const rows = await repo.search(s, query);
      return Object.freeze(rows.map((row) => projectCustomerSummary(row)));
    },

    async listCustomers(scope, query = {}) {
      const repo = requireRepository();
      const s = createCustomerScope(scope);
      const page = await repo.list(s, query);
      return Object.freeze({
        items: Object.freeze(page.items.map((row) => projectCustomerSummary(row))),
        total: page.total,
        limit: page.limit,
        offset: page.offset,
      });
    },
  });
}

/**
 * Fail-closed composition helper — returns a service that rejects until a
 * repository adapter is injected.
 *
 * @param {object} [deps]
 */
export function createFailClosedCustomerApplication(deps = {}) {
  return createCustomerApplicationService({
    ...deps,
    repository: deps.repository ?? null,
  });
}
