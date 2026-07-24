/**
 * Canonical Customer search query (CUSTOMER-06).
 * Exact + normalized match. Scope-safe. Deterministic sort applied by repositories.
 */

import { CUSTOMER_STATUS, isCustomerStatus } from "../constants/customerStatuses.js";
import { isCustomerType } from "../constants/customerTypes.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import {
  normalizeCustomerEmail,
  normalizeCustomerPhone,
} from "./normalization.js";

/**
 * @typedef {Readonly<{
 *   text: string|null,
 *   customerId: string|null,
 *   customerNumber: string|null,
 *   email: string|null,
 *   phone: string|null,
 *   normalizedEmail: string|null,
 *   normalizedPhone: string|null,
 *   externalReference: Readonly<{ type: string, id: string }>|null,
 *   customerType: string|null,
 *   status: string|null,
 *   limit: number,
 *   offset: number,
 *   includeMerged: boolean,
 * }>} CustomerSearchQuery
 */

/**
 * @param {object} [input]
 * @returns {CustomerSearchQuery}
 */
export function createCustomerSearchQuery(input = {}) {
  if (input != null && (typeof input !== "object" || Array.isArray(input))) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_SEARCH_QUERY,
      "Customer search query must be a plain object.",
      { field: "query" }
    );
  }

  const raw = input || {};
  const text =
    raw.text == null || raw.text === ""
      ? null
      : String(raw.text).trim() || null;

  const customerId =
    raw.customerId == null || raw.customerId === ""
      ? null
      : String(raw.customerId).trim() || null;

  const customerNumber =
    raw.customerNumber == null || raw.customerNumber === ""
      ? null
      : String(raw.customerNumber).trim() || null;

  let email = null;
  let normalizedEmail = null;
  if (raw.email != null && raw.email !== "") {
    try {
      const n = normalizeCustomerEmail(String(raw.email));
      email = n.displayValue;
      normalizedEmail = n.normalizedValue;
    } catch {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_SEARCH_QUERY,
        "email search value is invalid.",
        { field: "email" }
      );
    }
  }

  let phone = null;
  let normalizedPhone = null;
  if (raw.phone != null && raw.phone !== "") {
    try {
      const n = normalizeCustomerPhone(String(raw.phone));
      phone = n.displayValue;
      normalizedPhone = n.normalizedValue;
    } catch {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_SEARCH_QUERY,
        "phone search value is invalid.",
        { field: "phone" }
      );
    }
  }

  let externalReference = null;
  if (raw.externalReference != null) {
    if (
      typeof raw.externalReference !== "object" ||
      Array.isArray(raw.externalReference)
    ) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_SEARCH_QUERY,
        "externalReference must be { type, id }.",
        { field: "externalReference" }
      );
    }
    const type = String(raw.externalReference.type || "").trim();
    const id = String(raw.externalReference.id || "").trim();
    if (!type || !id) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_SEARCH_QUERY,
        "externalReference.type and externalReference.id are required.",
        { field: "externalReference" }
      );
    }
    externalReference = Object.freeze({ type, id });
  }

  let customerType = null;
  if (raw.customerType != null && raw.customerType !== "") {
    customerType = String(raw.customerType);
    if (!isCustomerType(customerType)) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_SEARCH_QUERY,
        "customerType is invalid.",
        { field: "customerType", customerType }
      );
    }
  }

  let status = null;
  if (raw.status != null && raw.status !== "") {
    status = String(raw.status);
    if (!isCustomerStatus(status)) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_SEARCH_QUERY,
        "status is invalid.",
        { field: "status", status }
      );
    }
  }

  const limit =
    Number.isInteger(raw.limit) && raw.limit > 0 ? raw.limit : 50;
  const offset =
    Number.isInteger(raw.offset) && raw.offset >= 0 ? raw.offset : 0;
  if (raw.limit != null && (!Number.isInteger(raw.limit) || raw.limit <= 0)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_SEARCH_QUERY,
      "limit must be a positive integer.",
      { field: "limit" }
    );
  }
  if (raw.offset != null && (!Number.isInteger(raw.offset) || raw.offset < 0)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_SEARCH_QUERY,
      "offset must be a non-negative integer.",
      { field: "offset" }
    );
  }

  const includeMerged = raw.includeMerged === true;

  return Object.freeze({
    text,
    customerId,
    customerNumber,
    email,
    phone,
    normalizedEmail,
    normalizedPhone,
    externalReference,
    customerType,
    status,
    limit,
    offset,
    includeMerged,
  });
}

/**
 * Deterministic sort for search results.
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareCustomersForSearch(a, b) {
  const dn = String(a?.displayName || "").localeCompare(
    String(b?.displayName || "")
  );
  if (dn !== 0) return dn;
  const cn = String(a?.customerNumber || "").localeCompare(
    String(b?.customerNumber || "")
  );
  if (cn !== 0) return cn;
  return String(a?.customerId || "").localeCompare(String(b?.customerId || ""));
}

/**
 * Match a customer aggregate against a canonical search query.
 * @param {object} row
 * @param {CustomerSearchQuery|object} query
 * @returns {boolean}
 */
export function customerMatchesSearchQuery(row, query = {}) {
  if (!row) return false;

  const includeMerged = query.includeMerged === true;
  if (
    !includeMerged &&
    row.status === CUSTOMER_STATUS.MERGED &&
    !query.status
  ) {
    return false;
  }

  if (query.customerId && row.customerId !== query.customerId) return false;
  if (query.customerNumber && row.customerNumber !== query.customerNumber) {
    return false;
  }
  if (query.customerType && row.customerType !== query.customerType) return false;
  if (query.status && row.status !== query.status) return false;

  if (query.normalizedEmail || query.email) {
    const needle = String(
      query.normalizedEmail || String(query.email || "").trim().toLowerCase()
    );
    const hit = (row.contactPoints || []).some((c) => {
      if (String(c.type || "").toUpperCase() !== "EMAIL") return false;
      const nv = String(c.normalizedValue || c.value || "")
        .trim()
        .toLowerCase();
      return nv === needle;
    });
    if (!hit) return false;
  }

  if (query.normalizedPhone || query.phone) {
    const needle = String(
      query.normalizedPhone ||
        String(query.phone || "").trim().replace(/\s+/g, "")
    );
    const hit = (row.contactPoints || []).some((c) => {
      if (String(c.type || "").toUpperCase() !== "PHONE") return false;
      const nv = String(c.normalizedValue || c.value || "").replace(/\s+/g, "");
      return nv === needle;
    });
    if (!hit) return false;
  }

  if (query.text) {
    const needle = String(query.text).trim().toLowerCase();
    if (needle) {
      const hay = [
        row.displayName,
        row.legalName,
        row.customerNumber,
        row.customerId,
        row.individualProfile?.givenName,
        row.individualProfile?.familyName,
        row.organizationProfile?.organizationName,
        ...(row.contactPoints || []).map(
          (c) =>
            `${c.value || ""} ${c.displayValue || ""} ${c.normalizedValue || ""}`
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
  }

  return true;
}

/**
 * Build address comparison key (deterministic).
 * @param {object} address
 * @returns {string|null}
 */
export function buildAddressMatchKey(address) {
  if (!address || typeof address !== "object") return null;
  const parts = [
    address.countryCode,
    address.adminArea,
    address.locality,
    address.postalCode,
    address.addressLine1,
  ]
    .map((p) => String(p || "").trim().toLowerCase())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return parts.join("|");
}
