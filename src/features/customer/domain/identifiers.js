/**
 * Customer identifier helpers (CUSTOMER-01).
 *
 * Canonical key: customerId (opaque string).
 * Optional human-facing code: customerNumber.
 *
 * References to other modules are opaque ids only — never embedded aggregates.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";

export const CUSTOMER_ID_PREFIX = "cust_";
export const CUSTOMER_NUMBER_PREFIX = "CUS-";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireOpaqueId(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_REFERENCE,
      `${field} is required.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
export function optionalOpaqueId(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_REFERENCE,
      `${field} must be a non-empty string when provided.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {string} entropy
 * @returns {string}
 */
export function mintCustomerId(entropy) {
  const token = requireOpaqueId(entropy, "entropy");
  return `${CUSTOMER_ID_PREFIX}${token}`;
}

/**
 * @param {string} entropy
 * @returns {string}
 */
export function mintCustomerNumber(entropy) {
  const token = requireOpaqueId(entropy, "entropy").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!token) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "customerNumber entropy produced an empty token.",
      { field: "customerNumber" }
    );
  }
  return `${CUSTOMER_NUMBER_PREFIX}${token.slice(0, 16)}`;
}
