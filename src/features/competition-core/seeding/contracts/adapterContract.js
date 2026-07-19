/**
 * Phase 3G — SeedingAdapter contract shape.
 */

export const SEEDING_ADAPTER_ID = Object.freeze({
  LEGACY: "LEGACY_SEEDING",
});

/**
 * @typedef {Object} SeedingAdapter
 * @property {string} id
 * @property {string} sourceType
 * @property {(source: unknown, context?: Record<string, unknown>) => boolean} supports
 * @property {(source: unknown, context?: Record<string, unknown>) =>
 *   import('./seedingCandidate.js').SeedingCandidate[]
 * } map
 */

/**
 * @param {unknown} adapter
 * @returns {adapter is SeedingAdapter}
 */
export function isSeedingAdapter(adapter) {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    typeof adapter.id === "string" &&
    typeof adapter.sourceType === "string" &&
    typeof adapter.supports === "function" &&
    typeof adapter.map === "function"
  );
}
