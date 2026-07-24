/**
 * Contact point types owned by Customer Management.
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
});

export const CONTACT_POINT_VERIFICATION_STATE_VALUES = Object.freeze(
  Object.values(CONTACT_POINT_VERIFICATION_STATE)
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
