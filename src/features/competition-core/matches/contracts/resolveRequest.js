/**
 * Phase 3F — resolve request contract.
 */

/**
 * @typedef {Object} MatchResolveRequest
 * @property {string} competitionId
 * @property {unknown} source
 * @property {string|null} [sourceType]
 * @property {string|null} [formatKey]
 * @property {Record<string, unknown>} [context]
 * @property {boolean} [allowShadow]
 */

/**
 * @param {Partial<MatchResolveRequest>|null|undefined} partial
 * @returns {MatchResolveRequest}
 */
export function createMatchResolveRequest(partial = {}) {
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
