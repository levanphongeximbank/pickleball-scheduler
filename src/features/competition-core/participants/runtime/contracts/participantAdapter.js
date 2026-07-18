/**
 * Phase 3B — ParticipantAdapter structural contract.
 * Format adapters map only — no business orchestration.
 */

export const PARTICIPANT_ADAPTER_ID = Object.freeze({
  LEGACY: "LegacyParticipantAdapter",
});

/**
 * @typedef {Object} ParticipantAdapter
 * @property {string} id
 * @property {string} sourceType
 * @property {(source: unknown, context?: Record<string, unknown>) => boolean} supports
 * @property {(source: unknown, context: Record<string, unknown>) => import('../../contracts/competitionParticipant.js').CompetitionParticipant} map
 */

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function isParticipantAdapter(adapter) {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    typeof adapter.id === "string" &&
    typeof adapter.sourceType === "string" &&
    typeof adapter.supports === "function" &&
    typeof adapter.map === "function"
  );
}
