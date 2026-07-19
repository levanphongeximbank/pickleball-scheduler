/**
 * Core-03 — reason severity. BLOCKING fails closed; WARNING does not alone deny eligibility.
 */

export const ELIGIBILITY_REASON_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  BLOCKING: "BLOCKING",
});

/** @type {ReadonlySet<string>} */
export const ELIGIBILITY_REASON_SEVERITY_VALUES = new Set(
  Object.values(ELIGIBILITY_REASON_SEVERITY)
);

/** Deterministic severity rank — lower sorts first (BLOCKING before WARNING before INFO). */
export const ELIGIBILITY_REASON_SEVERITY_RANK = Object.freeze({
  [ELIGIBILITY_REASON_SEVERITY.BLOCKING]: 0,
  [ELIGIBILITY_REASON_SEVERITY.WARNING]: 1,
  [ELIGIBILITY_REASON_SEVERITY.INFO]: 2,
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEligibilityReasonSeverity(value) {
  return typeof value === "string" && ELIGIBILITY_REASON_SEVERITY_VALUES.has(value);
}
