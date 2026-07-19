/**
 * Phase 3E — resolve request contract.
 */

/**
 * @typedef {Object} LineupResolveRequest
 * @property {string} competitionId
 * @property {unknown} source
 * @property {string|null} [sourceType]
 * @property {string|null} [formatKey]
 * @property {Record<string, unknown>} [context]
 * @property {boolean} [allowShadow]
 */

/**
 * @param {Partial<LineupResolveRequest>|null|undefined} partial
 * @returns {LineupResolveRequest}
 */
export function createLineupResolveRequest(partial = {}) {
  return {
    competitionId: String(partial?.competitionId || ""),
    source: partial?.source ?? null,
    sourceType:
      typeof partial?.sourceType === "string" && partial.sourceType
        ? partial.sourceType
        : null,
    formatKey:
      typeof partial?.formatKey === "string" && partial.formatKey
        ? partial.formatKey
        : null,
    context:
      partial?.context &&
      typeof partial.context === "object" &&
      !Array.isArray(partial.context)
        ? { ...partial.context }
        : {},
    allowShadow: partial?.allowShadow === true,
  };
}
