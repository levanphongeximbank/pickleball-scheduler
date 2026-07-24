/**
 * Read-only Customer redirect adapter for Notification / Finance consumers.
 * Does not mutate Customer state. Does not silently swap getById results.
 */

import { createCustomerScope } from "../domain/scope.js";
import {
  resolveCanonicalCustomerId,
  resolveMergedCustomer,
} from "../domain/mergeRedirect.js";
import { projectCustomerRedirectView } from "../projectors/mergeViews.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";

/**
 * @param {{
 *   customerRepository: object,
 *   mergeApplication?: object|null,
 * }} deps
 */
export function createCustomerRedirectAdapter(deps = {}) {
  const customerRepository = deps.customerRepository ?? null;
  const mergeApplication = deps.mergeApplication ?? null;

  function requireRepo() {
    if (!customerRepository || typeof customerRepository.getById !== "function") {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        "CustomerRedirectAdapter requires customerRepository.",
        { adapter: "CustomerRedirectAdapter" }
      );
    }
    return customerRepository;
  }

  return Object.freeze({
    /**
     * Resolve canonical survivor id for a possibly-merged customer.
     * @param {object} scope
     * @param {string} customerId
     * @returns {Promise<string>}
     */
    async resolveCanonicalCustomerId(scope, customerId) {
      if (mergeApplication?.resolveCanonicalCustomerId) {
        return mergeApplication.resolveCanonicalCustomerId(scope, customerId);
      }
      const repo = requireRepo();
      const s = createCustomerScope(scope);
      return resolveCanonicalCustomerId(s, customerId, {
        getById: (sc, id) => repo.getById(sc, id),
      });
    },

    /**
     * Full redirect projection (requested → canonical + chain).
     * @param {object} scope
     * @param {string} customerId
     */
    async resolveRedirect(scope, customerId) {
      if (mergeApplication?.resolveMergedCustomer) {
        return mergeApplication.resolveMergedCustomer(scope, customerId);
      }
      const repo = requireRepo();
      const s = createCustomerScope(scope);
      const result = await resolveMergedCustomer(s, customerId, {
        getById: (sc, id) => repo.getById(sc, id),
      });
      return projectCustomerRedirectView(result);
    },

    /**
     * Read the stored customer record as-is (MERGED records are returned, not swapped).
     * @param {object} scope
     * @param {string} customerId
     */
    async getStoredCustomer(scope, customerId) {
      const repo = requireRepo();
      const s = createCustomerScope(scope);
      return repo.getById(s, customerId);
    },
  });
}
