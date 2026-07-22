/**
 * CORE-14 — AvailabilityCertification (advisory disclosure).
 */

export const AVAILABILITY_CERTIFICATION = Object.freeze({
  FULL: "FULL",
  PARTIAL: "PARTIAL",
  NOT_EVALUATED: "NOT_EVALUATED",
});

export const AVAILABILITY_CERTIFICATION_VALUES = Object.freeze([
  AVAILABILITY_CERTIFICATION.FULL,
  AVAILABILITY_CERTIFICATION.PARTIAL,
  AVAILABILITY_CERTIFICATION.NOT_EVALUATED,
]);

const AVAILABILITY_CERTIFICATION_SET = new Set(AVAILABILITY_CERTIFICATION_VALUES);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isAvailabilityCertification(value) {
  return typeof value === "string" && AVAILABILITY_CERTIFICATION_SET.has(value);
}

export const AVAILABILITY_MODE = Object.freeze({
  AUTHORITATIVE: "AUTHORITATIVE",
  ADVISORY: "ADVISORY",
});

export const AVAILABILITY_MODE_VALUES = Object.freeze([
  AVAILABILITY_MODE.AUTHORITATIVE,
  AVAILABILITY_MODE.ADVISORY,
]);

const AVAILABILITY_MODE_SET = new Set(AVAILABILITY_MODE_VALUES);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isAvailabilityMode(value) {
  return typeof value === "string" && AVAILABILITY_MODE_SET.has(value);
}
