/**
 * Contact point value object (CUSTOMER-01).
 * Verification runtime is deferred — foundation stores verificationState only.
 */

import {
  CONTACT_POINT_TYPE,
  CONTACT_POINT_VERIFICATION_STATE,
  isContactPointType,
  isContactPointVerificationState,
} from "../constants/contactPointTypes.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { requireOpaqueId } from "./identifiers.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s\-()]{5,31}$/;

/**
 * @param {unknown} value
 * @param {string} type
 * @returns {string}
 */
function normalizeContactValue(value, type) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
      "Contact point value is required.",
      { field: "value", type }
    );
  }
  const trimmed = value.trim();
  if (type === CONTACT_POINT_TYPE.EMAIL) {
    const normalized = trimmed.toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
        "Contact point email format is invalid.",
        { field: "value", type }
      );
    }
    return normalized;
  }
  if (type === CONTACT_POINT_TYPE.PHONE) {
    if (!PHONE_PATTERN.test(trimmed)) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
        "Contact point phone format is invalid.",
        { field: "value", type }
      );
    }
    return trimmed.replace(/\s+/g, " ");
  }
  throwCustomerError(
    CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
    "Unsupported contact point type.",
    { field: "type", type }
  );
}

/**
 * @param {object} input
 * @returns {Readonly<{
 *   contactPointId: string,
 *   type: string,
 *   value: string,
 *   primary: boolean,
 *   verificationState: string,
 * }>}
 */
export function createContactPoint(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
      "Contact point input must be a plain object."
    );
  }
  const type = String(input.type || "");
  if (!isContactPointType(type)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
      "Contact point type must be EMAIL or PHONE.",
      { field: "type", type }
    );
  }
  const verificationState = input.verificationState
    ? String(input.verificationState)
    : CONTACT_POINT_VERIFICATION_STATE.UNVERIFIED;
  if (!isContactPointVerificationState(verificationState)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
      "Contact point verificationState is invalid.",
      { field: "verificationState", verificationState }
    );
  }
  return Object.freeze({
    contactPointId: requireOpaqueId(input.contactPointId, "contactPointId"),
    type,
    value: normalizeContactValue(input.value, type),
    primary: Boolean(input.primary),
    verificationState,
  });
}

/**
 * Ensure at most one primary contact point overall (and per type when typed).
 *
 * @param {readonly object[]} contactPoints
 * @returns {readonly object[]}
 */
export function assertPrimaryContactUniqueness(contactPoints) {
  const list = Array.isArray(contactPoints) ? contactPoints : [];
  const primaries = list.filter((item) => item && item.primary === true);
  if (primaries.length > 1) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CONFLICTING_PRIMARY_CONTACT,
      "Only one primary contact point is allowed.",
      { primaryCount: primaries.length }
    );
  }
  return list;
}
