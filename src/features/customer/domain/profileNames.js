/**
 * Individual / organization profile name contracts (CUSTOMER-02).
 */

import { CUSTOMER_TYPE } from "../constants/customerTypes.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
export function optionalProfileString(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_PROFILE,
      `${field} must be a string when provided.`,
      { field }
    );
  }
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireProfileString(value, field) {
  const trimmed = optionalProfileString(value, field);
  if (!trimmed) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_PROFILE,
      `${field} is required.`,
      { field }
    );
  }
  return trimmed;
}

/**
 * @param {object|null|undefined} input
 * @returns {Readonly<object>|null}
 */
export function createIndividualProfile(input) {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_PROFILE,
      "individualProfile must be a plain object when provided.",
      { field: "individualProfile" }
    );
  }
  return Object.freeze({
    givenName: optionalProfileString(input.givenName, "givenName"),
    familyName: optionalProfileString(input.familyName, "familyName"),
    middleName: optionalProfileString(input.middleName, "middleName"),
    preferredName: optionalProfileString(input.preferredName, "preferredName"),
  });
}

/**
 * @param {object|null|undefined} input
 * @returns {Readonly<object>|null}
 */
export function createOrganizationProfile(input) {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_PROFILE,
      "organizationProfile must be a plain object when provided.",
      { field: "organizationProfile" }
    );
  }
  return Object.freeze({
    organizationName: optionalProfileString(
      input.organizationName,
      "organizationName"
    ),
    tradingName: optionalProfileString(input.tradingName, "tradingName"),
  });
}

/**
 * Derive displayName when not explicitly provided.
 *
 * @param {object} input
 * @param {string} customerType
 * @param {Readonly<object>|null} individualProfile
 * @param {Readonly<object>|null} organizationProfile
 * @returns {string}
 */
export function resolveDisplayName(
  input,
  customerType,
  individualProfile,
  organizationProfile
) {
  const explicit = optionalProfileString(
    input.displayName ?? input.name,
    "displayName"
  );
  if (explicit) return explicit;

  if (customerType === CUSTOMER_TYPE.INDIVIDUAL) {
    const preferred = individualProfile?.preferredName;
    if (preferred) return preferred;
    const parts = [
      individualProfile?.givenName,
      individualProfile?.middleName,
      individualProfile?.familyName,
    ].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  if (customerType === CUSTOMER_TYPE.ORGANIZATION) {
    if (organizationProfile?.organizationName) {
      return organizationProfile.organizationName;
    }
    if (organizationProfile?.tradingName) {
      return organizationProfile.tradingName;
    }
  }

  throwCustomerError(
    CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_PROFILE,
    "displayName is required (or derivable from profile name fields).",
    { field: "displayName", customerType }
  );
}

/**
 * Enforce type ↔ profile shape consistency (fail-closed).
 *
 * @param {string} customerType
 * @param {Readonly<object>|null} individualProfile
 * @param {Readonly<object>|null} organizationProfile
 */
export function assertProfileTypeConsistency(
  customerType,
  individualProfile,
  organizationProfile
) {
  if (customerType === CUSTOMER_TYPE.INDIVIDUAL) {
    if (organizationProfile) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH,
        "INDIVIDUAL customers cannot carry organizationProfile.",
        { customerType }
      );
    }
    return;
  }
  if (customerType === CUSTOMER_TYPE.ORGANIZATION) {
    if (individualProfile) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH,
        "ORGANIZATION customers cannot carry individualProfile.",
        { customerType }
      );
    }
    // organizationProfile is optional for displayName-only CUSTOMER-01 rows;
    // when present it must include organizationName.
    if (organizationProfile && !organizationProfile.organizationName) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_PROFILE,
        "organizationProfile.organizationName is required when organizationProfile is provided.",
        { field: "organizationName", customerType }
      );
    }
  }
}
