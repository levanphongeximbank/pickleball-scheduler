/** Phase 3G — seeding assignment / candidate source types. */

export const SEEDING_SOURCE_TYPE = Object.freeze({
  MANUAL: "MANUAL",
  PROTECTED: "PROTECTED",
  RANKING: "RANKING",
  RATING: "RATING",
  SOURCE_PRIORITY: "SOURCE_PRIORITY",
  IDENTITY: "IDENTITY",
  DETERMINISTIC_RANDOM: "DETERMINISTIC_RANDOM",
  COMPOSITE: "COMPOSITE",
  LEGACY: "LEGACY",
  UNKNOWN: "UNKNOWN",
});

/** @type {ReadonlySet<string>} */
export const SEEDING_SOURCE_TYPE_VALUES = new Set(
  Object.values(SEEDING_SOURCE_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSeedingSourceType(value) {
  return typeof value === "string" && SEEDING_SOURCE_TYPE_VALUES.has(value);
}
