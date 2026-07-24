/**
 * Contact point types / lifecycle owned by Customer Management.
 * Verification runtime is deferred — foundation stores verificationState only.
 */

export const CONTACT_POINT_TYPE = Object.freeze({
  EMAIL: "EMAIL",
  PHONE: "PHONE",
});

export const CONTACT_POINT_TYPE_VALUES = Object.freeze(
  Object.values(CONTACT_POINT_TYPE)
);

export const CONTACT_POINT_VERIFICATION_STATE = Object.freeze({
  UNVERIFIED: "UNVERIFIED",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
  REJECTED: "REJECTED",
});

export const CONTACT_POINT_VERIFICATION_STATE_VALUES = Object.freeze(
  Object.values(CONTACT_POINT_VERIFICATION_STATE)
);

export const CONTACT_POINT_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
});

export const CONTACT_POINT_STATUS_VALUES = Object.freeze(
  Object.values(CONTACT_POINT_STATUS)
);

export const CONTACT_POINT_PURPOSE = Object.freeze({
  GENERAL: "GENERAL",
  BILLING: "BILLING",
  OPERATIONS: "OPERATIONS",
  OTHER: "OTHER",
});

export const CONTACT_POINT_PURPOSE_VALUES = Object.freeze(
  Object.values(CONTACT_POINT_PURPOSE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isContactPointType(value) {
  return CONTACT_POINT_TYPE_VALUES.includes(String(value || ""));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isContactPointVerificationState(value) {
  return CONTACT_POINT_VERIFICATION_STATE_VALUES.includes(String(value || ""));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isContactPointStatus(value) {
  return CONTACT_POINT_STATUS_VALUES.includes(String(value || ""));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isContactPointPurpose(value) {
  return CONTACT_POINT_PURPOSE_VALUES.includes(String(value || ""));
}
