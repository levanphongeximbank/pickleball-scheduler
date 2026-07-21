/**
 * CORE-06 Phase 1E — audit-safe mutation / visibility metadata.
 * No secrets, tokens, or hidden opponent lineup contents.
 */

/**
 * @typedef {Object} LineupAuditMetadata
 * @property {string|null} tenantId
 * @property {string|null} competitionId
 * @property {string|null} teamId
 * @property {string|null} lineupIdentityKey
 * @property {number|null} previousVersion
 * @property {number|null} resultingVersion
 * @property {string|null} commandType
 * @property {unknown} actor
 * @property {string|null} source
 * @property {string|null} idempotencyKey
 * @property {string|null} commandFingerprint
 * @property {string|null} resultFingerprint
 * @property {string|null} evaluatedAt
 * @property {string|null} reasonCode
 * @property {string|null} correctionReason
 */

/**
 * @param {Partial<LineupAuditMetadata>} [partial]
 * @returns {LineupAuditMetadata}
 */
export function createLineupAuditMetadata(partial = {}) {
  const actor =
    partial.actor && typeof partial.actor === "object"
      ? Object.freeze({
          actorId:
            /** @type {{ actorId?: unknown }} */ (partial.actor).actorId != null
              ? String(/** @type {{ actorId?: unknown }} */ (partial.actor).actorId)
              : null,
          actorRole:
            /** @type {{ actorRole?: unknown }} */ (partial.actor).actorRole !=
            null
              ? String(
                  /** @type {{ actorRole?: unknown }} */ (partial.actor)
                    .actorRole
                )
              : null,
        })
      : partial.actor != null
        ? Object.freeze({ actorId: String(partial.actor), actorRole: null })
        : null;

  return Object.freeze({
    tenantId:
      partial.tenantId != null && String(partial.tenantId).trim() !== ""
        ? String(partial.tenantId).trim()
        : null,
    competitionId:
      partial.competitionId != null &&
      String(partial.competitionId).trim() !== ""
        ? String(partial.competitionId).trim()
        : null,
    teamId:
      partial.teamId != null && String(partial.teamId).trim() !== ""
        ? String(partial.teamId).trim()
        : null,
    lineupIdentityKey:
      partial.lineupIdentityKey != null &&
      String(partial.lineupIdentityKey).trim() !== ""
        ? String(partial.lineupIdentityKey).trim()
        : null,
    previousVersion:
      typeof partial.previousVersion === "number" &&
      Number.isInteger(partial.previousVersion)
        ? partial.previousVersion
        : null,
    resultingVersion:
      typeof partial.resultingVersion === "number" &&
      Number.isInteger(partial.resultingVersion)
        ? partial.resultingVersion
        : null,
    commandType:
      partial.commandType != null && String(partial.commandType).trim() !== ""
        ? String(partial.commandType).trim()
        : null,
    actor,
    source:
      partial.source != null && String(partial.source).trim() !== ""
        ? String(partial.source).trim()
        : null,
    idempotencyKey:
      partial.idempotencyKey != null &&
      String(partial.idempotencyKey).trim() !== ""
        ? String(partial.idempotencyKey).trim()
        : null,
    commandFingerprint:
      partial.commandFingerprint != null &&
      String(partial.commandFingerprint).trim() !== ""
        ? String(partial.commandFingerprint).trim()
        : null,
    resultFingerprint:
      partial.resultFingerprint != null &&
      String(partial.resultFingerprint).trim() !== ""
        ? String(partial.resultFingerprint).trim()
        : null,
    evaluatedAt:
      partial.evaluatedAt != null && String(partial.evaluatedAt).trim() !== ""
        ? String(partial.evaluatedAt).trim()
        : null,
    reasonCode:
      partial.reasonCode != null && String(partial.reasonCode).trim() !== ""
        ? String(partial.reasonCode).trim()
        : null,
    correctionReason:
      partial.correctionReason != null &&
      String(partial.correctionReason).trim() !== ""
        ? String(partial.correctionReason).trim()
        : null,
  });
}
