/**
 * Scale identifiers for dual-read compare.
 * No Owner-approved canonical mapping — raw compare + UNAPPROVED status only.
 */

export const RATING_SCALE_ID = Object.freeze({
  PICK_VN_V2_1_TO_8: "PICK_VN_V2_1_TO_8",
  PICK_VN_V5_1_5_TO_6: "PICK_VN_V5_1_5_TO_6",
});

export const SCALE_MAPPING_STATUS = Object.freeze({
  UNAPPROVED: "UNAPPROVED",
  APPROVED: "APPROVED",
  DISABLED: "DISABLED",
});

export const SCALE_MAPPING_STRATEGY = Object.freeze({
  RAW_ONLY: "RAW_ONLY",
  LINEAR: "LINEAR",
  BOUNDED_PIECEWISE: "BOUNDED_PIECEWISE",
  CATEGORY_BAND: "CATEGORY_BAND",
});

export const V2_SCALE_BOUNDS = Object.freeze({ min: 1.0, max: 8.0 });
export const V5_SCALE_BOUNDS = Object.freeze({ min: 1.5, max: 6.0 });
