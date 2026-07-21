/** Consent record status values (Phase 1F). Append-only history. */

export const CONSENT_STATUS = Object.freeze({
  GRANTED: "GRANTED",
  REVOKED: "REVOKED",
});

export const CONSENT_STATUS_VALUES = Object.freeze(Object.values(CONSENT_STATUS));

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isConsentStatus(status) {
  return CONSENT_STATUS_VALUES.includes(String(status || ""));
}
