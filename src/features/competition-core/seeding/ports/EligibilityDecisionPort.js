/**
 * CORE-07 EligibilityDecisionPort contract only — no CORE-03 adapter (doc 11).
 */

import { CORE07_ELIGIBILITY_PORT_VERSION } from "../domain/constants.js";

/**
 * @typedef {Object} EligibilityDecision
 * @property {string} entryId
 * @property {Record<string, unknown>} scopeRef
 * @property {string} decisionVersion
 * @property {string} status
 * @property {string[]} reasonCodes
 * @property {string} [evidenceRef]
 * @property {string|number} decidedAt
 */

/**
 * @typedef {Object} EligibilityDecisionPort
 * @property {string} contractVersion
 * @property {(input: {
 *   seedingScope: import('../domain/normalizeSeedingScope.js').SeedingScope,
 *   entryIds: string[],
 *   embeddedDecisions?: EligibilityDecision[],
 *   effectiveAt: string|number,
 * }) => {
 *   ok: boolean,
 *   decisionsByEntryId: Map<string, EligibilityDecision>|Record<string, EligibilityDecision>,
 *   reasonCodes: string[],
 *   evidenceRefs?: string[],
 * }} resolveDecisions
 */

/**
 * @param {unknown} port
 * @returns {port is EligibilityDecisionPort}
 */
export function isEligibilityDecisionPort(port) {
  return (
    !!port &&
    typeof port === "object" &&
    typeof /** @type {EligibilityDecisionPort} */ (port).resolveDecisions ===
      "function" &&
    /** @type {EligibilityDecisionPort} */ (port).contractVersion ===
      CORE07_ELIGIBILITY_PORT_VERSION
  );
}

export { CORE07_ELIGIBILITY_PORT_VERSION };
