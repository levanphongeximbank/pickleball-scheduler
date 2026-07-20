/**
 * EligibilityEvidenceLookupPort — read latest eligibility evaluation evidence.
 * Phase 1D uses this to gate reservation / promotion without importing Core-01/02.
 *
 * @typedef {import('../contracts/eligibilityEvaluationEvidence.js').EligibilityEvaluationEvidence} EligibilityEvaluationEvidence
 */

import { cloneJsonSafe } from "../contracts/shared.js";
import { createEligibilityEvaluationEvidence } from "../contracts/eligibilityEvaluationEvidence.js";
import { ELIGIBILITY_OUTCOME } from "../enums/eligibilityOutcome.js";

export const ELIGIBILITY_EVIDENCE_LOOKUP_PORT_METHODS = Object.freeze([
  "getLatestByRegistrationId",
  "saveEvidence",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesEligibilityEvidenceLookupPort(port) {
  if (!port || typeof port !== "object") return false;
  return typeof /** @type {any} */ (port).getLatestByRegistrationId === "function";
}

/**
 * @param {EligibilityEvaluationEvidence[]} [seed]
 */
export function createInMemoryEligibilityEvidenceLookupPort(seed = []) {
  /** @type {Map<string, EligibilityEvaluationEvidence>} */
  const latestByRegistration = new Map();

  for (const item of seed) {
    const evidence = createEligibilityEvaluationEvidence(item);
    latestByRegistration.set(evidence.registrationId, evidence);
  }

  return {
    /**
     * @param {string} registrationId
     * @returns {Promise<EligibilityEvaluationEvidence|null>}
     */
    async getLatestByRegistrationId(registrationId) {
      const evidence = latestByRegistration.get(String(registrationId || ""));
      return evidence
        ? /** @type {EligibilityEvaluationEvidence} */ (cloneJsonSafe(evidence))
        : null;
    },

    /**
     * Test/helper write — not a Production persistence API.
     * @param {EligibilityEvaluationEvidence} evidence
     */
    async saveEvidence(evidence) {
      const stored = createEligibilityEvaluationEvidence(evidence);
      latestByRegistration.set(
        stored.registrationId,
        /** @type {EligibilityEvaluationEvidence} */ (cloneJsonSafe(stored))
      );
      return /** @type {EligibilityEvaluationEvidence} */ (cloneJsonSafe(stored));
    },
  };
}

/**
 * @returns {{ getLatestByRegistrationId: Function }}
 */
export function createNullEligibilityEvidenceLookupPort() {
  return {
    async getLatestByRegistrationId() {
      return null;
    },
  };
}

/**
 * Valid promotion/reservation eligibility outcomes within Core-03.
 * @type {ReadonlySet<string>}
 */
export const CAPACITY_VALID_ELIGIBILITY_OUTCOMES = Object.freeze(
  new Set([ELIGIBILITY_OUTCOME.ELIGIBLE, ELIGIBILITY_OUTCOME.CONDITIONAL])
);
