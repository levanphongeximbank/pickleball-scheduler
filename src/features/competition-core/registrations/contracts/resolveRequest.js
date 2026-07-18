/**
 * Phase 3C — resolve request contract.
 */

/**
 * @typedef {Object} RegistrationResolveRequest
 * @property {string} competitionId
 * @property {unknown} source
 * @property {string} [sourceType]
 * @property {string} [registrationKind]
 * @property {string} [formatKey]
 * @property {Record<string, unknown>} [context]
 * @property {boolean} [allowShadow]
 */

/**
 * @param {Partial<RegistrationResolveRequest>|null|undefined} partial
 * @returns {RegistrationResolveRequest}
 */
export function createRegistrationResolveRequest(partial = {}) {
  return {
    competitionId: String(partial?.competitionId || ""),
    source: partial?.source ?? null,
    sourceType:
      typeof partial?.sourceType === "string" && partial.sourceType
        ? partial.sourceType
        : null,
    registrationKind:
      typeof partial?.registrationKind === "string" && partial.registrationKind
        ? partial.registrationKind
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
