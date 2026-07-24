/**
 * Contact point value object (CUSTOMER-01 + CUSTOMER-02).
 *
 * Business contact master data — not an authentication credential.
 * Verification runtime is deferred; services must not mark VERIFIED without
 * trusted external evidence.
 */

import {
  CONTACT_POINT_PURPOSE,
  CONTACT_POINT_STATUS,
  CONTACT_POINT_TYPE,
  CONTACT_POINT_VERIFICATION_STATE,
  isContactPointPurpose,
  isContactPointStatus,
  isContactPointType,
  isContactPointVerificationState,
} from "../constants/contactPointTypes.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { requireOpaqueId } from "./identifiers.js";
import {
  normalizeCustomerEmail,
  normalizeCustomerPhone,
} from "./normalization.js";

/**
 * @param {unknown} value
 * @param {string} type
 * @returns {{ displayValue: string, normalizedValue: string }}
 */
function normalizeByType(value, type) {
  if (type === CONTACT_POINT_TYPE.EMAIL) {
    return normalizeCustomerEmail(value);
  }
  if (type === CONTACT_POINT_TYPE.PHONE) {
    return normalizeCustomerPhone(value);
  }
  throwCustomerError(
    CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
    "Unsupported contact point type.",
    { field: "type", type }
  );
}

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, allowVerifiedWithoutEvidence?: boolean }} [deps]
 * @returns {Readonly<object>}
 */
export function createContactPoint(input = {}, deps = {}) {
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
  if (
    verificationState === CONTACT_POINT_VERIFICATION_STATE.VERIFIED &&
    !deps.allowVerifiedWithoutEvidence &&
    input.trustedEvidence !== true
  ) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
      "Contact points cannot be marked VERIFIED without trusted external evidence.",
      { field: "verificationState", verificationState }
    );
  }

  const status = input.status
    ? String(input.status)
    : CONTACT_POINT_STATUS.ACTIVE;
  if (!isContactPointStatus(status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
      "Contact point status is invalid.",
      { field: "status", status }
    );
  }

  const purpose = input.purpose
    ? String(input.purpose)
    : input.label
      ? String(input.label)
      : CONTACT_POINT_PURPOSE.GENERAL;
  if (!isContactPointPurpose(purpose)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
      "Contact point purpose/label is invalid.",
      { field: "purpose", purpose }
    );
  }

  const rawValue =
    input.value !== undefined
      ? input.value
      : input.normalizedValue !== undefined
        ? input.normalizedValue
        : input.displayValue;
  const { displayValue, normalizedValue } = normalizeByType(
    input.displayValue !== undefined && input.value === undefined
      ? input.displayValue
      : rawValue,
    type
  );
  const resolvedDisplay =
    input.displayValue != null && String(input.displayValue).trim()
      ? String(input.displayValue).trim()
      : displayValue;

  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const createdAt = input.createdAt ? String(input.createdAt) : nowIso();
  const updatedAt = input.updatedAt ? String(input.updatedAt) : createdAt;

  return Object.freeze({
    contactPointId: requireOpaqueId(input.contactPointId, "contactPointId"),
    type,
    /** @deprecated Prefer normalizedValue; retained for CUSTOMER-01 consumers. */
    value: normalizedValue,
    normalizedValue,
    displayValue: resolvedDisplay,
    purpose,
    label: purpose,
    primary: Boolean(input.primary),
    verificationState,
    status,
    createdAt,
    updatedAt,
    version:
      Number.isInteger(input.version) && input.version > 0 ? input.version : 1,
  });
}

/**
 * Ensure at most one primary ACTIVE contact point per type (EMAIL / PHONE).
 * Inactive contacts never participate in the primary invariant.
 *
 * @param {readonly object[]} contactPoints
 * @returns {readonly object[]}
 */
export function assertPrimaryContactUniqueness(contactPoints) {
  const list = Array.isArray(contactPoints) ? contactPoints : [];
  const activePrimaries = list.filter(
    (item) =>
      item &&
      item.primary === true &&
      (item.status || CONTACT_POINT_STATUS.ACTIVE) === CONTACT_POINT_STATUS.ACTIVE
  );

  for (const type of CONTACT_POINT_TYPE_VALUES_SAFE()) {
    const count = activePrimaries.filter((item) => item.type === type).length;
    if (count > 1) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.PRIMARY_CONTACT_CONFLICT,
        `Only one primary active ${type} contact point is allowed.`,
        {
          type,
          primaryCount: count,
          codeAlias: CUSTOMER_ERROR_CODES.CONFLICTING_PRIMARY_CONTACT,
        }
      );
    }
  }
  return list;
}

function CONTACT_POINT_TYPE_VALUES_SAFE() {
  return [CONTACT_POINT_TYPE.EMAIL, CONTACT_POINT_TYPE.PHONE];
}

/**
 * Reject duplicate normalized contact values within the same customer (ACTIVE).
 *
 * @param {readonly object[]} contactPoints
 * @returns {readonly object[]}
 */
export function assertNoDuplicateContactValues(contactPoints) {
  const list = Array.isArray(contactPoints) ? contactPoints : [];
  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const item of list) {
    if (!item) continue;
    if (
      (item.status || CONTACT_POINT_STATUS.ACTIVE) !== CONTACT_POINT_STATUS.ACTIVE
    ) {
      continue;
    }
    const key = `${item.type}:${item.normalizedValue || item.value}`;
    if (seen.has(key)) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.DUPLICATE_CONTACT_POINT,
        "Duplicate active contact point value on the same customer.",
        {
          type: item.type,
          normalizedValue: item.normalizedValue || item.value,
          existingContactPointId: seen.get(key),
          conflictingContactPointId: item.contactPointId,
        }
      );
    }
    seen.set(key, item.contactPointId);
  }
  return list;
}

/**
 * @param {readonly object[]} contactPoints
 * @returns {readonly object[]}
 */
export function assertContactPointInvariants(contactPoints) {
  assertNoDuplicateContactValues(contactPoints);
  return assertPrimaryContactUniqueness(contactPoints);
}
