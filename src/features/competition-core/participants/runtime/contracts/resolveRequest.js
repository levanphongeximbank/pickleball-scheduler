/**
 * Phase 3B — resolve request contract.
 */

/**
 * @typedef {Object} ParticipantResolveRequest
 * @property {string} competitionId
 * @property {unknown} source
 * @property {string} [sourceType]
 * @property {string} [formatKey]
 * @property {Record<string, unknown>} [context]
 * @property {boolean} [allowShadow]
 */

/**
 * @param {Partial<ParticipantResolveRequest>|null|undefined} partial
 * @returns {ParticipantResolveRequest}
 */
export function createParticipantResolveRequest(partial = {}) {
  return {
    competitionId: String(partial?.competitionId || ""),
    source: partial?.source ?? null,
    sourceType:
      typeof partial?.sourceType === "string" && partial.sourceType
        ? partial.sourceType
        : "LEGACY",
    formatKey:
      typeof partial?.formatKey === "string" && partial.formatKey
        ? partial.formatKey
        : null,
    context:
      partial?.context && typeof partial.context === "object" && !Array.isArray(partial.context)
        ? { ...partial.context }
        : {},
    allowShadow: partial?.allowShadow === true,
  };
}
