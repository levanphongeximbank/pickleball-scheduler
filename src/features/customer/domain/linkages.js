/**
 * Typed linkage value objects — opaque foreign references only.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { optionalOpaqueId, requireOpaqueId } from "./identifiers.js";

/**
 * @param {object|null|undefined} input
 * @returns {Readonly<{ userAccountId: string }>|null}
 */
export function createAccountLinkage(input) {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_REFERENCE,
      "Account linkage must be a plain object or null.",
      { field: "accountLinkage" }
    );
  }
  return Object.freeze({
    userAccountId: requireOpaqueId(
      input.userAccountId ?? input.authUserId,
      "userAccountId"
    ),
  });
}

/**
 * @param {object|null|undefined} input
 * @returns {Readonly<{ playerId: string }>|null}
 */
export function createPlayerLinkage(input) {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_REFERENCE,
      "Player linkage must be a plain object or null.",
      { field: "playerLinkage" }
    );
  }
  return Object.freeze({
    playerId: requireOpaqueId(input.playerId, "playerId"),
  });
}

/**
 * @param {object|null|undefined} input
 * @returns {Readonly<{ organizationId: string }>|null}
 */
export function createOrganizationLinkage(input) {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_REFERENCE,
      "Organization linkage must be a plain object or null.",
      { field: "organizationLinkage" }
    );
  }
  return Object.freeze({
    organizationId: requireOpaqueId(input.organizationId, "organizationId"),
  });
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function optionalLinkageId(value) {
  return optionalOpaqueId(value, "linkageId");
}
