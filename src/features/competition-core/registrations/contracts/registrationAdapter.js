/**
 * Phase 3C — RegistrationAdapter contract shape.
 */

export const REGISTRATION_ADAPTER_ID = Object.freeze({
  LEGACY: "LEGACY_REGISTRATION",
});

/**
 * @typedef {Object} RegistrationAdapter
 * @property {string} id
 * @property {string} sourceType
 * @property {(source: unknown, context?: Record<string, unknown>) => boolean} supports
 * @property {(source: unknown, context?: Record<string, unknown>) =>
 *   import('../../participants/contracts/entryRegistration.js').CompetitionRegistration
 * } map
 */

/**
 * @param {unknown} adapter
 * @returns {adapter is RegistrationAdapter}
 */
export function isRegistrationAdapter(adapter) {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    typeof adapter.id === "string" &&
    typeof adapter.sourceType === "string" &&
    typeof adapter.supports === "function" &&
    typeof adapter.map === "function"
  );
}
