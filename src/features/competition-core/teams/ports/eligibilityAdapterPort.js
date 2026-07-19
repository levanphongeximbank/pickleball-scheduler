/**
 * Core-05 — eligibility adapter port.
 * Default: not required; when required and missing/negative → fail closed.
 */

/**
 * @typedef {Object} TeamEligibilityRequest
 * @property {string} operation
 * @property {unknown} [team]
 * @property {unknown} [roster]
 * @property {unknown} [person]
 * @property {Record<string, unknown>} [context]
 */

/**
 * @typedef {Object} TeamEligibilityResult
 * @property {boolean} ok
 * @property {string|null} [code]
 * @property {string|null} [message]
 */

/**
 * @typedef {Object} TeamEligibilityAdapter
 * @property {(request: TeamEligibilityRequest) => boolean|Promise<boolean>} isRequired
 * @property {(request: TeamEligibilityRequest) => TeamEligibilityResult|Promise<TeamEligibilityResult>} assertEligible
 */

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function matchesEligibilityAdapter(adapter) {
  return Boolean(
    adapter &&
      typeof adapter === "object" &&
      typeof adapter.isRequired === "function" &&
      typeof adapter.assertEligible === "function"
  );
}

/**
 * Not required by default; assertEligible fails closed if invoked without config.
 * @returns {TeamEligibilityAdapter}
 */
export function createFailClosedEligibilityAdapter() {
  return {
    async isRequired() {
      return false;
    },
    async assertEligible() {
      return {
        ok: false,
        code: "ELIGIBILITY_REQUIRED",
        message: "Eligibility context missing — fail closed",
      };
    },
  };
}

/**
 * @param {{ isRequired?: boolean|((req: TeamEligibilityRequest) => boolean|Promise<boolean>), assertEligible?: (req: TeamEligibilityRequest) => TeamEligibilityResult|Promise<TeamEligibilityResult> }} [options]
 * @returns {TeamEligibilityAdapter}
 */
export function createEligibilityAdapter(options = {}) {
  const isRequiredOpt = options.isRequired;
  const assertEligibleOpt = options.assertEligible;
  return {
    async isRequired(request) {
      if (typeof isRequiredOpt === "function") return Boolean(await isRequiredOpt(request));
      return Boolean(isRequiredOpt);
    },
    async assertEligible(request) {
      if (typeof assertEligibleOpt === "function") {
        return assertEligibleOpt(request);
      }
      return {
        ok: false,
        code: "ELIGIBILITY_REQUIRED",
        message: "Eligibility adapter required but not configured — fail closed",
      };
    },
  };
}
