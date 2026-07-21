/**
 * CORE-07 RuleEvaluationPort contract only — no CORE-01 adapter (doc 11).
 */

import { CORE07_RULE_EVALUATION_PORT_VERSION } from "../domain/constants.js";

/**
 * @typedef {Object} RuleEvaluationPort
 * @property {string} contractVersion
 * @property {(input: {
 *   seedingScope: import('../domain/normalizeSeedingScope.js').SeedingScope,
 *   candidates: unknown[],
 *   operation: 'SEEDING',
 *   effectiveAt: string|number,
 *   context?: Record<string, unknown>,
 * }) => {
 *   ok: boolean,
 *   ruleSetId: string,
 *   ruleSetVersion: string,
 *   resultsByEntryId: Map<string, { hardPass: boolean, softWarnings: string[], reasonCodes: string[] }>|Record<string, unknown>,
 *   traceRef?: string,
 * }} evaluateSeedingRules
 */

/**
 * @param {unknown} port
 * @returns {port is RuleEvaluationPort}
 */
export function isRuleEvaluationPort(port) {
  return (
    !!port &&
    typeof port === "object" &&
    typeof /** @type {RuleEvaluationPort} */ (port).evaluateSeedingRules ===
      "function" &&
    /** @type {RuleEvaluationPort} */ (port).contractVersion ===
      CORE07_RULE_EVALUATION_PORT_VERSION
  );
}

export { CORE07_RULE_EVALUATION_PORT_VERSION };
