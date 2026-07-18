/**
 * Phase 3D — resolve request contracts (team + roster).
 */

/**
 * @typedef {Object} TeamResolveRequest
 * @property {string} competitionId
 * @property {unknown} source
 * @property {string} [sourceType]
 * @property {string} [formatKey]
 * @property {Record<string, unknown>} [context]
 * @property {boolean} [allowShadow]
 */

/**
 * @typedef {Object} RosterResolveRequest
 * @property {string} competitionId
 * @property {unknown} source
 * @property {string} [sourceType]
 * @property {string} [formatKey]
 * @property {Record<string, unknown>} [context]
 * @property {boolean} [allowShadow]
 */

/**
 * @param {Partial<TeamResolveRequest>|null|undefined} partial
 * @returns {TeamResolveRequest}
 */
export function createTeamResolveRequest(partial = {}) {
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
      partial?.context && typeof partial.context === "object" && !Array.isArray(partial.context)
        ? { ...partial.context }
        : {},
    allowShadow: partial?.allowShadow === true,
  };
}

/**
 * @param {Partial<RosterResolveRequest>|null|undefined} partial
 * @returns {RosterResolveRequest}
 */
export function createRosterResolveRequest(partial = {}) {
  return createTeamResolveRequest(partial);
}
