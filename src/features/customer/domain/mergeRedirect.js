/**
 * Merged-customer redirect resolution (CUSTOMER-06).
 * getById still returns the MERGED record; redirect is a separate projection.
 */

import { CUSTOMER_STATUS } from "../constants/customerStatuses.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";

const DEFAULT_MAX_DEPTH = 8;

/**
 * Follow mergedIntoCustomerId chain to the canonical survivor.
 *
 * @param {object} scope
 * @param {string} customerId
 * @param {{
 *   getById: (scope: object, id: string) => object|null|Promise<object|null>,
 *   maxDepth?: number,
 * }} deps
 * @returns {Promise<{
 *   requestedCustomerId: string,
 *   canonicalCustomerId: string,
 *   redirectChain: string[],
 *   mergedAt: string|null,
 *   reason: string|null,
 *   depth: number,
 * }>}
 */
export async function resolveMergedCustomer(scope, customerId, deps) {
  const maxDepth =
    Number.isInteger(deps.maxDepth) && deps.maxDepth > 0
      ? deps.maxDepth
      : DEFAULT_MAX_DEPTH;
  const requestedCustomerId = String(customerId || "").trim();
  if (!requestedCustomerId) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_REFERENCE,
      "customerId is required for redirect resolution.",
      { field: "customerId" }
    );
  }

  /** @type {string[]} */
  const redirectChain = [];
  let currentId = requestedCustomerId;
  /** @type {string|null} */
  let mergedAt = null;
  let depth = 0;

  while (depth < maxDepth) {
    const row = await deps.getById(scope, currentId);
    if (!row) {
      if (depth === 0) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.NOT_FOUND,
          "Customer not found.",
          { customerId: currentId }
        );
      }
      break;
    }

    if (row.status !== CUSTOMER_STATUS.MERGED || !row.mergedIntoCustomerId) {
      return Object.freeze({
        requestedCustomerId,
        canonicalCustomerId: row.customerId,
        redirectChain: Object.freeze(redirectChain),
        mergedAt,
        reason:
          redirectChain.length > 0 ? "FOLLOWED_MERGED_REDIRECT" : null,
        depth,
      });
    }

    const nextId = String(row.mergedIntoCustomerId).trim();
    if (!nextId) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.CUSTOMER_MERGE_CYCLE,
        "Merged customer is missing mergedIntoCustomerId.",
        { customerId: row.customerId }
      );
    }
    if (redirectChain.includes(nextId) || nextId === currentId) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.CUSTOMER_MERGE_CYCLE,
        "Customer merge redirect cycle detected.",
        { customerId: requestedCustomerId, chain: [...redirectChain, nextId] }
      );
    }

    redirectChain.push(row.customerId);
    mergedAt = row.mergedAt || mergedAt;
    currentId = nextId;
    depth += 1;
  }

  throwCustomerError(
    CUSTOMER_ERROR_CODES.CUSTOMER_MERGE_CYCLE,
    "Customer merge redirect exceeded max depth.",
    { customerId: requestedCustomerId, maxDepth, depth }
  );
}

/**
 * @param {object} scope
 * @param {string} customerId
 * @param {object} deps
 * @returns {Promise<string>}
 */
export async function resolveCanonicalCustomerId(scope, customerId, deps) {
  const result = await resolveMergedCustomer(scope, customerId, deps);
  return result.canonicalCustomerId;
}
