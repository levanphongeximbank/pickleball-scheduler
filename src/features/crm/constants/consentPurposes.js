/** Approved consent purpose codes (Phase 1F). */

export const CONSENT_PURPOSE = Object.freeze({
  MARKETING: "MARKETING",
  TRANSACTIONAL: "TRANSACTIONAL",
  SERVICE: "SERVICE",
  RESEARCH: "RESEARCH",
});

export const CONSENT_PURPOSE_VALUES = Object.freeze(Object.values(CONSENT_PURPOSE));

/**
 * @param {string} purpose
 * @returns {boolean}
 */
export function isConsentPurpose(purpose) {
  return CONSENT_PURPOSE_VALUES.includes(String(purpose || ""));
}
