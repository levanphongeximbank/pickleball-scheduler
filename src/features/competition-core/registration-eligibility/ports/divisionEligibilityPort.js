/**
 * DivisionEligibilityPort — Core-04 adjacent; descriptors / lane open-state only.
 * Core-03 orchestrates; does not own Division/Category definitions.
 *
 * @typedef {Object} DivisionEligibilityPort
 * @property {(args: {
 *   competitionId: string,
 *   divisionId?: string|null,
 *   divisionCategoryId?: string|null,
 * }) => Promise<{
 *   acceptsRegistration: boolean,
 *   eligibilityDescriptor?: unknown,
 *   capacity?: unknown,
 *   reasonCodes?: string[],
 * }>} getDivisionEligibilityContext
 */

/**
 * @returns {DivisionEligibilityPort}
 */
export function createNullDivisionEligibilityPort() {
  return {
    async getDivisionEligibilityContext() {
      return {
        acceptsRegistration: false,
        reasonCodes: ["DIVISION_PORT_UNAVAILABLE"],
      };
    },
  };
}

/**
 * @param {(args: any) => any|Promise<any>} [impl]
 * @returns {DivisionEligibilityPort}
 */
export function createStubDivisionEligibilityPort(impl) {
  return {
    async getDivisionEligibilityContext(args) {
      if (typeof impl === "function") {
        return impl(args);
      }
      return {
        acceptsRegistration: true,
        reasonCodes: [],
      };
    },
  };
}

export const DIVISION_ELIGIBILITY_PORT_METHODS = Object.freeze([
  "getDivisionEligibilityContext",
]);
