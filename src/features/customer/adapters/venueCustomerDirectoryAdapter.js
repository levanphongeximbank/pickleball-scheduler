/**
 * CRM-compatible VenueCustomerDirectoryPort adapter over Customer repository.
 * Read-only. Does not modify CRM module.
 */

import { createCustomerScope } from "../domain/scope.js";
import { projectCustomerDetails } from "../projectors/customerSummary.js";

/**
 * @param {import("../repositories/ports.js").CustomerRepository} repository
 * @returns {{ getById: Function, search: Function }}
 */
export function createVenueCustomerDirectoryAdapter(repository) {
  if (!repository) {
    throw new Error("VenueCustomerDirectoryAdapter requires a CustomerRepository.");
  }
  return Object.freeze({
    async getById(scope, customerId) {
      const s = createCustomerScope(scope);
      const row = await repository.getById(s, customerId);
      return row ? projectCustomerDetails(row) : null;
    },
    async search(scope, query = {}) {
      const s = createCustomerScope(scope);
      const rows = await repository.search(s, query);
      return rows.map((row) => projectCustomerDetails(row));
    },
  });
}
