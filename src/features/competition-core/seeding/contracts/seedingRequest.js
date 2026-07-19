/**
 * Phase 3G — SeedingRequest / resolve request contract.
 */

/**
 * @typedef {Object} SeedingResolveRequest
 * @property {string} competitionId
 * @property {string} contextId
 * @property {unknown} [source]
 * @property {string|null} [sourceType]
 * @property {string|null} [formatKey]
 * @property {Array<Record<string, unknown>>} [candidates]
 * @property {unknown} [deterministicSeed]
 * @property {Record<string, unknown>} [context]
 * @property {Record<string, unknown>} [options]
 * @property {boolean} [allowShadow]
 */

/**
 * @param {Partial<SeedingResolveRequest>|null|undefined} partial
 * @returns {SeedingResolveRequest}
 */
export function createSeedingResolveRequest(partial = {}) {
  return {
    competitionId: String(partial?.competitionId || ""),
    contextId: String(partial?.contextId || ""),
    source: partial?.source ?? null,
    sourceType:
      typeof partial?.sourceType === "string" && partial.sourceType
        ? partial.sourceType
        : null,
    formatKey:
      typeof partial?.formatKey === "string" && partial.formatKey
        ? partial.formatKey
        : null,
    candidates: Array.isArray(partial?.candidates)
      ? partial.candidates.map((item) =>
          item && typeof item === "object" ? { ...item } : {}
        )
      : [],
    deterministicSeed:
      partial?.deterministicSeed !== undefined
        ? partial.deterministicSeed
        : undefined,
    context:
      partial?.context &&
      typeof partial.context === "object" &&
      !Array.isArray(partial.context)
        ? { ...partial.context }
        : {},
    options:
      partial?.options &&
      typeof partial.options === "object" &&
      !Array.isArray(partial.options)
        ? { ...partial.options }
        : {},
    allowShadow: partial?.allowShadow === true,
  };
}

/** @deprecated Prefer createSeedingResolveRequest — alias for docs clarity. */
export function createSeedingRequest(partial) {
  return createSeedingResolveRequest(partial);
}
