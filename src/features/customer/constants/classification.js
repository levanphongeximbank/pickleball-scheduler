/**
 * Controlled classification / segmentation reference codes.
 * CRM owns sales segmentation logic; Customer stores opaque references only.
 */

export const CUSTOMER_CLASSIFICATION_KIND = Object.freeze({
  LEGACY_VENUE_TYPE: "LEGACY_VENUE_TYPE",
  BUSINESS_TAG: "BUSINESS_TAG",
  SEGMENT_REF: "SEGMENT_REF",
});

export const CUSTOMER_CLASSIFICATION_KIND_VALUES = Object.freeze(
  Object.values(CUSTOMER_CLASSIFICATION_KIND)
);

/**
 * Legacy venue customerType values from `src/models/customer.js`.
 * Retained as classification references only — not canonical CUSTOMER_TYPE.
 */
export const LEGACY_VENUE_CUSTOMER_TYPE = Object.freeze({
  WALK_IN: "walk_in",
  MEMBER: "member",
  CLUB: "club",
  VISITOR: "visitor",
});

export const LEGACY_VENUE_CUSTOMER_TYPE_VALUES = Object.freeze(
  Object.values(LEGACY_VENUE_CUSTOMER_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomerClassificationKind(value) {
  return CUSTOMER_CLASSIFICATION_KIND_VALUES.includes(String(value || ""));
}
