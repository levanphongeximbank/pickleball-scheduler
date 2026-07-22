/**
 * CORE-12 — CourtAvailabilityStatus (snapshot field from Competition Availability Adapter).
 */

export const COURT_AVAILABILITY_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
  LOCKED: "LOCKED",
  MAINTENANCE: "MAINTENANCE",
  DISABLED: "DISABLED",
});

export const COURT_AVAILABILITY_STATUS_VALUES = Object.freeze(
  Object.values(COURT_AVAILABILITY_STATUS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCourtAvailabilityStatus(value) {
  return COURT_AVAILABILITY_STATUS_VALUES.includes(
    /** @type {string} */ (value)
  );
}
