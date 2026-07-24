/**
 * Customer address value object (CUSTOMER-02 contract).
 * No geocoding, map integration, or address verification runtime.
 */

import {
  CUSTOMER_ADDRESS_STATUS,
  CUSTOMER_ADDRESS_TYPE,
  isCustomerAddressStatus,
  isCustomerAddressType,
} from "../constants/addressTypes.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { requireOpaqueId } from "./identifiers.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @param {boolean} required
 * @returns {string|null}
 */
function optionalOrRequiredLine(value, field, required) {
  if (value == null || value === "") {
    if (required) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_ADDRESS,
        `${field} is required.`,
        { field }
      );
    }
    return null;
  }
  if (typeof value !== "string") {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_ADDRESS,
      `${field} must be a string when provided.`,
      { field }
    );
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_ADDRESS,
        `${field} is required.`,
        { field }
      );
    }
    return null;
  }
  return trimmed;
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createCustomerAddress(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_ADDRESS,
      "Address input must be a plain object."
    );
  }

  const addressType = String(input.addressType || CUSTOMER_ADDRESS_TYPE.POSTAL);
  if (!isCustomerAddressType(addressType)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_ADDRESS,
      "addressType is invalid.",
      { field: "addressType", addressType }
    );
  }

  const status = String(input.status || CUSTOMER_ADDRESS_STATUS.ACTIVE);
  if (!isCustomerAddressStatus(status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_ADDRESS,
      "address status is invalid.",
      { field: "status", status }
    );
  }

  const countryCode = optionalOrRequiredLine(
    input.countryCode ?? "VN",
    "countryCode",
    true
  );
  if (!/^[A-Za-z]{2}$/.test(countryCode)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_ADDRESS,
      "countryCode must be an ISO-3166 alpha-2 code.",
      { field: "countryCode", countryCode }
    );
  }

  return Object.freeze({
    addressId: requireOpaqueId(input.addressId, "addressId"),
    addressType,
    addressLine1: optionalOrRequiredLine(input.addressLine1, "addressLine1", true),
    addressLine2: optionalOrRequiredLine(input.addressLine2, "addressLine2", false),
    locality: optionalOrRequiredLine(
      input.locality ?? input.ward ?? input.district,
      "locality",
      false
    ),
    adminArea: optionalOrRequiredLine(
      input.adminArea ?? input.province ?? input.city,
      "adminArea",
      false
    ),
    postalCode: optionalOrRequiredLine(input.postalCode, "postalCode", false),
    countryCode: countryCode.toUpperCase(),
    primary: Boolean(input.primary),
    status,
    createdAt: input.createdAt ? String(input.createdAt) : null,
    updatedAt: input.updatedAt ? String(input.updatedAt) : null,
    version:
      Number.isInteger(input.version) && input.version > 0 ? input.version : 1,
  });
}

/**
 * At most one primary ACTIVE address.
 *
 * @param {readonly object[]} addresses
 * @returns {readonly object[]}
 */
export function assertPrimaryAddressUniqueness(addresses) {
  const list = Array.isArray(addresses) ? addresses : [];
  const primaries = list.filter(
    (item) =>
      item &&
      item.primary === true &&
      item.status === CUSTOMER_ADDRESS_STATUS.ACTIVE
  );
  if (primaries.length > 1) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.PRIMARY_CONTACT_CONFLICT,
      "Only one primary active address is allowed.",
      { primaryCount: primaries.length }
    );
  }
  return list;
}
