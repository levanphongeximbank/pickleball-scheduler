/**
 * Phase 3H — DrawAdapter contract shape.
 */

export const DRAW_ADAPTER_ID = Object.freeze({
  LEGACY: "LEGACY_DRAW",
});

/**
 * @typedef {Object} DrawAdapter
 * @property {string} id
 * @property {string} sourceType
 * @property {(source: unknown, context?: Record<string, unknown>) => boolean} supports
 * @property {(source: unknown, context?: Record<string, unknown>) =>
 *   import('./drawCandidate.js').DrawCandidate[]
 * } map
 */

/**
 * @param {unknown} adapter
 * @returns {adapter is DrawAdapter}
 */
export function isDrawAdapter(adapter) {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    typeof adapter.id === "string" &&
    typeof adapter.sourceType === "string" &&
    typeof adapter.supports === "function" &&
    typeof adapter.map === "function"
  );
}
