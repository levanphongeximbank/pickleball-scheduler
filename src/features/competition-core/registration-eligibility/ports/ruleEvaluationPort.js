/**
 * RuleEvaluationPort — Core-01 adjacent; Core-03 orchestrates, does not own rule engine.
 *
 * @typedef {Object} RuleEvaluationRequest
 * @property {string} competitionId
 * @property {string|null} [ruleSetId]
 * @property {string|null} [ruleSetVersion]
 * @property {string} operation
 * @property {Record<string, unknown>} [subject]
 * @property {Record<string, unknown>} [context]
 */

/**
 * @typedef {Object} RuleEvaluationPort
 * @property {(request: RuleEvaluationRequest) => Promise<{
 *   accepted: boolean,
 *   reasonCodes: string[],
 *   ruleSetVersion?: string|null,
 *   traceRef?: string|null,
 * }>} evaluateRules
 */

/**
 * @returns {RuleEvaluationPort}
 */
export function createNullRuleEvaluationPort() {
  return {
    async evaluateRules() {
      return {
        accepted: false,
        reasonCodes: ["RULE_EVALUATION_PORT_UNAVAILABLE"],
        ruleSetVersion: null,
        traceRef: null,
      };
    },
  };
}

/**
 * @param {(req: RuleEvaluationRequest) => any|Promise<any>} [impl]
 * @returns {RuleEvaluationPort}
 */
export function createStubRuleEvaluationPort(impl) {
  return {
    async evaluateRules(request) {
      if (typeof impl === "function") {
        return impl(request);
      }
      return {
        accepted: true,
        reasonCodes: [],
        ruleSetVersion: request.ruleSetVersion ?? null,
        traceRef: null,
      };
    },
  };
}

export const RULE_EVALUATION_PORT_METHODS = Object.freeze(["evaluateRules"]);
