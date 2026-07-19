/**
 * Format applicability flags for a CompetitionCategory.
 * Descriptor only — does not evaluate participants.
 */

/**
 * @typedef {Object} CategoryApplicability
 * @property {boolean} individual
 * @property {boolean} doubles
 * @property {boolean} mixed
 * @property {boolean} team
 */

/**
 * @param {Partial<CategoryApplicability>|null|undefined} partial
 * @returns {CategoryApplicability}
 */
export function createApplicability(partial = {}) {
  return {
    individual: partial?.individual === true,
    doubles: partial?.doubles === true,
    mixed: partial?.mixed === true,
    team: partial?.team === true,
  };
}
