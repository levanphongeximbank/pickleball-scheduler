/**
 * Customer Application Service (CUSTOMER-01 + CUSTOMER-02).
 * Fail-closed when repository adapter is not configured.
 */

import {
  CONTACT_POINT_STATUS,
  CONTACT_POINT_TYPE,
} from "../constants/contactPointTypes.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import {
  addCustomerAddress,
  addCustomerContactPoint,
  changeCustomerStatus,
  createCustomerProfile,
  deactivateCustomerContactPoint,
  removeCustomerAddress,
  removeCustomerContactPoint,
  setCustomerLinkage,
  setPrimaryCustomerAddress,
  setPrimaryCustomerContactPoint,
  updateCustomerAddress,
  updateCustomerContactPoint,
  updateCustomerProfileFields,
} from "../domain/customerProfile.js";
import { createCustomerScope } from "../domain/scope.js";
import {
  createSequentialCustomerIdGenerator,
  createSystemCustomerClock,
} from "../repositories/ports.js";
import {
  projectCustomerContactView,
  projectCustomerDetails,
  projectCustomerProfileView,
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

  /**
   * @param {object} customer
   * @param {number|undefined|null} expectedVersion
   */
  function assertExpectedVersion(customer, expectedVersion) {
    if (expectedVersion == null) return;
    const expected = Number(expectedVersion);
    if (!Number.isInteger(expected) || expected !== customer.version) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Customer version conflict.",
        {
          customerId: customer.customerId,
          expectedVersion: expected,
          actualVersion: customer.version,
        }
      );
    }
  }

  function primaryOfType(contactPoints, type) {
    return (
      (contactPoints || []).find(
        (c) =>
          c.primary &&
          c.type === type &&
          (c.status || CONTACT_POINT_STATUS.ACTIVE) === CONTACT_POINT_STATUS.ACTIVE
      ) || null
    );
  }

  async function assertNoDuplicate(repo, scope, customer, excludeCustomerId = null) {
    const primaryEmail = primaryOfType(customer.contactPoints, CONTACT_POINT_TYPE.EMAIL);
    const primaryPhone = primaryOfType(customer.contactPoints, CONTACT_POINT_TYPE.PHONE);
    const duplicate = await repo.findDuplicate(scope, {
      excludeCustomerId,
      customerNumber: customer.customerNumber,
      primaryEmail: primaryEmail?.normalizedValue || primaryEmail?.value,
      primaryPhone: primaryPhone?.normalizedValue || primaryPhone?.value,
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

  async function persist(repo, scope, customer, excludeCustomerId = null) {
    await assertNoDuplicate(repo, scope, customer, excludeCustomerId);
    const saved = await repo.save(customer);
    return projectCustomerDetails(saved);
  }

  async function addContactPoint(scope, customerId, contactInput, options = {}) {
    const { repo, scope: s, customer } = await loadRequired(scope, customerId);
    assertExpectedVersion(customer, options.expectedVersion);
    const updated = addCustomerContactPoint(customer, contactInput, domainDeps());
    return persist(repo, s, updated, customer.customerId);
  }

  async function updateContactPoint(
    scope,
    customerId,
    contactPointId,
    patch,
    options = {}
  ) {
    const { repo, scope: s, customer } = await loadRequired(scope, customerId);
    assertExpectedVersion(customer, options.expectedVersion);
    const updated = updateCustomerContactPoint(
      customer,
      contactPointId,
      patch,
      domainDeps()
    );
    return persist(repo, s, updated, customer.customerId);
  }

  async function removeContactPoint(scope, customerId, contactPointId, options = {}) {
    const { repo, customer } = await loadRequired(scope, customerId);
    assertExpectedVersion(customer, options.expectedVersion);
    const updated = removeCustomerContactPoint(customer, contactPointId, domainDeps());
    const saved = await repo.save(updated);
    return projectCustomerDetails(saved);
  }

  async function deactivateContactPoint(
    scope,
    customerId,
    contactPointId,
    options = {}
  ) {
    const { repo, customer } = await loadRequired(scope, customerId);
    assertExpectedVersion(customer, options.expectedVersion);
    const updated = deactivateCustomerContactPoint(
      customer,
      contactPointId,
      domainDeps()
    );
    const saved = await repo.save(updated);
    return projectCustomerDetails(saved);
  }

  return Object.freeze({
    /**
     * @param {object} input
     */
    async createCustomer(input = {}) {
      const repo = requireRepository();
      const scope = createCustomerScope(input);
      const customer = createCustomerProfile(input, domainDeps());
      return persist(repo, scope, customer);
    },

    async getCustomer(scope, customerId) {
      const { customer } = await loadRequired(scope, customerId);
      return projectCustomerDetails(customer);
    },

    async getCustomerProfile(scope, customerId) {
      const { customer } = await loadRequired(scope, customerId);
      return projectCustomerProfileView(customer);
    },

    async getCustomerContacts(scope, customerId) {
      const { customer } = await loadRequired(scope, customerId);
      return Object.freeze(
        (customer.contactPoints || []).map((c) => projectCustomerContactView(c))
      );
    },

    /**
     * @param {object} scope
     * @param {string} customerId
     * @param {object} [patch]
     * @param {{ expectedVersion?: number }} [options]
     */
    async updateCustomerProfile(scope, customerId, patch = {}, options = {}) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = updateCustomerProfileFields(customer, patch, domainDeps());
      return persist(repo, s, updated, customer.customerId);
    },

    async changeStatus(scope, customerId, nextStatus, options = {}) {
      const { repo, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = changeCustomerStatus(customer, nextStatus, domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    addContactPoint,
    updateContactPoint,
    removeContactPoint,
    deactivateContactPoint,

    async addEmail(scope, customerId, emailInput = {}, options = {}) {
      return addContactPoint(
        scope,
        customerId,
        {
          ...emailInput,
          type: CONTACT_POINT_TYPE.EMAIL,
          value: emailInput.value ?? emailInput.email ?? emailInput.displayValue,
        },
        options
      );
    },

    async updateEmail(scope, customerId, contactPointId, patch = {}, options = {}) {
      return updateContactPoint(
        scope,
        customerId,
        contactPointId,
        {
          ...patch,
          type: CONTACT_POINT_TYPE.EMAIL,
          value: patch.value ?? patch.email ?? patch.displayValue,
        },
        options
      );
    },

    async removeEmail(scope, customerId, contactPointId, options = {}) {
      return removeContactPoint(scope, customerId, contactPointId, options);
    },

    async deactivateEmail(scope, customerId, contactPointId, options = {}) {
      return deactivateContactPoint(scope, customerId, contactPointId, options);
    },

    async setPrimaryEmail(scope, customerId, contactPointId, options = {}) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = setPrimaryCustomerContactPoint(
        customer,
        contactPointId,
        CONTACT_POINT_TYPE.EMAIL,
        domainDeps()
      );
      return persist(repo, s, updated, customer.customerId);
    },

    async addPhone(scope, customerId, phoneInput = {}, options = {}) {
      return addContactPoint(
        scope,
        customerId,
        {
          ...phoneInput,
          type: CONTACT_POINT_TYPE.PHONE,
          value: phoneInput.value ?? phoneInput.phone ?? phoneInput.displayValue,
        },
        options
      );
    },

    async updatePhone(scope, customerId, contactPointId, patch = {}, options = {}) {
      return updateContactPoint(
        scope,
        customerId,
        contactPointId,
        {
          ...patch,
          type: CONTACT_POINT_TYPE.PHONE,
          value: patch.value ?? patch.phone ?? patch.displayValue,
        },
        options
      );
    },

    async removePhone(scope, customerId, contactPointId, options = {}) {
      return removeContactPoint(scope, customerId, contactPointId, options);
    },

    async deactivatePhone(scope, customerId, contactPointId, options = {}) {
      return deactivateContactPoint(scope, customerId, contactPointId, options);
    },

    async setPrimaryPhone(scope, customerId, contactPointId, options = {}) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = setPrimaryCustomerContactPoint(
        customer,
        contactPointId,
        CONTACT_POINT_TYPE.PHONE,
        domainDeps()
      );
      return persist(repo, s, updated, customer.customerId);
    },

    async addAddress(scope, customerId, addressInput, options = {}) {
      const { repo, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = addCustomerAddress(customer, addressInput, domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async updateAddress(scope, customerId, addressId, patch, options = {}) {
      const { repo, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = updateCustomerAddress(customer, addressId, patch, domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async removeAddress(scope, customerId, addressId, options = {}) {
      const { repo, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = removeCustomerAddress(customer, addressId, domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async setPrimaryAddress(scope, customerId, addressId, options = {}) {
      const { repo, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = setPrimaryCustomerAddress(customer, addressId, domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async linkUserAccount(scope, customerId, userAccountId, options = {}) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = setCustomerLinkage(
        customer,
        { userAccountId },
        "account",
        domainDeps()
      );
      return persist(repo, s, updated, customer.customerId);
    },

    async unlinkUserAccount(scope, customerId, options = {}) {
      const { repo, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = setCustomerLinkage(customer, null, "account", domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async linkPlayer(scope, customerId, playerId, options = {}) {
      const { repo, scope: s, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = setCustomerLinkage(customer, { playerId }, "player", domainDeps());
      return persist(repo, s, updated, customer.customerId);
    },

    async unlinkPlayer(scope, customerId, options = {}) {
      const { repo, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
      const updated = setCustomerLinkage(customer, null, "player", domainDeps());
      const saved = await repo.save(updated);
      return projectCustomerDetails(saved);
    },

    async linkOrganization(scope, customerId, organizationId, options = {}) {
      const { repo, customer } = await loadRequired(scope, customerId);
      assertExpectedVersion(customer, options.expectedVersion);
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
