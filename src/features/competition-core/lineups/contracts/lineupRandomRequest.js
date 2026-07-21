/**
 * CORE-06 Phase 1D — LineupRandomPort request / result factories.
 */

/**
 * @typedef {Object} LineupRandomScope
 * @property {string|null} [tenantId]
 * @property {string|null} [competitionId]
 * @property {string|null} [teamId]
 * @property {string|null} [rosterId]
 * @property {string|number|null} [rosterVersion]
 * @property {string|null} [contextId]
 */

/**
 * @typedef {Object} LineupRandomActor
 * @property {string|null} [actorId]
 * @property {string|null} [actorRole]
 * @property {string|null} [actorType]
 */

/**
 * @typedef {Object} LineupRandomSelectRequest
 * @property {string} seed
 * @property {string} lineupIdentityKey
 * @property {unknown} rosterSnapshot
 * @property {unknown} slotTemplate
 * @property {import('./lineupRandomPolicy.js').LineupRandomPolicy|null} [policy]
 * @property {LineupRandomScope|null} [scope]
 * @property {LineupRandomActor|null} [actor]
 * @property {string|null} [source]
 * @property {string|null} [idempotencyKey]
 * @property {string|number|null} [expectedVersion]
 * @property {string|null} [lineupRevisionId]
 * @property {string|null} [commandId]
 * @property {Record<string, unknown>} [extras]
 */

/**
 * @typedef {Object} LineupRandomSelectedSlot
 * @property {string} disciplineOrSideKey
 * @property {number} index
 * @property {string} identityToken
 * @property {{ kind: string, id: string }} person
 */

/**
 * @typedef {Object} LineupRandomSelectResult
 * @property {boolean} ok
 * @property {boolean} deterministic
 * @property {LineupRandomSelectedSlot[]} selectedSlots
 * @property {string|null} normalizedSeed
 * @property {string|null} seedFingerprint
 * @property {string|null} algorithmId
 * @property {string|null} algorithmVersion
 * @property {string|null} inputFingerprint
 * @property {string|null} selectionFingerprint
 * @property {import('./missingLineupResolution.js').MissingLineupResolution|null} resolution
 * @property {string|null} code
 * @property {string|null} message
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<LineupRandomSelectRequest>} [partial]
 * @returns {LineupRandomSelectRequest}
 */
export function createLineupRandomSelectRequest(partial = {}) {
  return {
    seed: partial.seed != null ? String(partial.seed) : "",
    lineupIdentityKey:
      partial.lineupIdentityKey != null
        ? String(partial.lineupIdentityKey)
        : "",
    rosterSnapshot: partial.rosterSnapshot ?? null,
    slotTemplate: partial.slotTemplate ?? null,
    policy: partial.policy ?? null,
    scope:
      partial.scope && typeof partial.scope === "object"
        ? { ...partial.scope }
        : null,
    actor:
      partial.actor && typeof partial.actor === "object"
        ? { ...partial.actor }
        : null,
    source:
      partial.source != null && String(partial.source).trim() !== ""
        ? String(partial.source).trim()
        : null,
    idempotencyKey:
      partial.idempotencyKey != null &&
      String(partial.idempotencyKey).trim() !== ""
        ? String(partial.idempotencyKey).trim()
        : null,
    expectedVersion:
      partial.expectedVersion != null ? partial.expectedVersion : null,
    lineupRevisionId:
      partial.lineupRevisionId != null &&
      String(partial.lineupRevisionId).trim() !== ""
        ? String(partial.lineupRevisionId).trim()
        : null,
    commandId:
      partial.commandId != null && String(partial.commandId).trim() !== ""
        ? String(partial.commandId).trim()
        : null,
    extras:
      partial.extras && typeof partial.extras === "object"
        ? { ...partial.extras }
        : {},
  };
}

/**
 * @param {Partial<LineupRandomSelectResult>} [partial]
 * @returns {LineupRandomSelectResult}
 */
export function createLineupRandomSelectResult(partial = {}) {
  const ok = partial.ok === true;
  return {
    ok,
    deterministic: partial.deterministic === true || ok,
    selectedSlots: Array.isArray(partial.selectedSlots)
      ? partial.selectedSlots.map((s) => Object.freeze({ ...s }))
      : [],
    normalizedSeed:
      partial.normalizedSeed != null &&
      String(partial.normalizedSeed).trim() !== ""
        ? String(partial.normalizedSeed)
        : null,
    seedFingerprint:
      partial.seedFingerprint != null &&
      String(partial.seedFingerprint).trim() !== ""
        ? String(partial.seedFingerprint)
        : null,
    algorithmId:
      partial.algorithmId != null && String(partial.algorithmId).trim() !== ""
        ? String(partial.algorithmId)
        : null,
    algorithmVersion:
      partial.algorithmVersion != null &&
      String(partial.algorithmVersion).trim() !== ""
        ? String(partial.algorithmVersion)
        : null,
    inputFingerprint:
      partial.inputFingerprint != null &&
      String(partial.inputFingerprint).trim() !== ""
        ? String(partial.inputFingerprint)
        : null,
    selectionFingerprint:
      partial.selectionFingerprint != null &&
      String(partial.selectionFingerprint).trim() !== ""
        ? String(partial.selectionFingerprint)
        : null,
    resolution: partial.resolution ?? null,
    code: typeof partial.code === "string" ? partial.code : null,
    message: typeof partial.message === "string" ? partial.message : null,
    metadata:
      partial.metadata && typeof partial.metadata === "object"
        ? { ...partial.metadata }
        : {},
  };
}
