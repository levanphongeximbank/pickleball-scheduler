/**
 * Core-05 — classification / division context adapter.
 * Determines which opaque division references are required.
 * Does not import Core-04 internals.
 */

/**
 * @typedef {Object} ClassificationRequirements
 * @property {boolean} requireTenantId
 * @property {boolean} requireDivisionId
 * @property {boolean} requireDivisionCategoryId
 */

/**
 * @typedef {Object} ClassificationContextAdapter
 * @property {(context?: Record<string, unknown>) => ClassificationRequirements|Promise<ClassificationRequirements>} resolveRequirements
 */

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function matchesClassificationAdapter(adapter) {
  return Boolean(
    adapter &&
      typeof adapter === "object" &&
      typeof adapter.resolveRequirements === "function"
  );
}

/**
 * Default: nothing required beyond competitionId (enforced by service).
 * @returns {ClassificationContextAdapter}
 */
export function createOptionalClassificationAdapter() {
  return {
    async resolveRequirements() {
      return {
        requireTenantId: false,
        requireDivisionId: false,
        requireDivisionCategoryId: false,
      };
    },
  };
}

/**
 * @param {Partial<ClassificationRequirements>} requirements
 * @returns {ClassificationContextAdapter}
 */
export function createClassificationAdapter(requirements = {}) {
  const frozen = {
    requireTenantId: requirements.requireTenantId === true,
    requireDivisionId: requirements.requireDivisionId === true,
    requireDivisionCategoryId: requirements.requireDivisionCategoryId === true,
  };
  return {
    async resolveRequirements() {
      return { ...frozen };
    },
  };
}
