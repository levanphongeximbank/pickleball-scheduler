/**
 * CORE-06 Phase 1C — VisibilityGrant contract.
 * Server SoT projection decision; no production adapter in this phase.
 */

import { PARTICIPANT_SCHEMA_VERSION } from "../../participants/contracts/shared.js";

/**
 * @typedef {Object} LineupVisibilityGrant
 * @property {string} schemaVersion
 * @property {string} actorId
 * @property {string|null} actorRole
 * @property {string} competitionId
 * @property {string} contextId
 * @property {string} teamId
 * @property {boolean} visible
 * @property {string|null} reason
 * @property {string|null} [lineupId]
 * @property {string|null} [identityKey]
 */

/**
 * @param {Partial<LineupVisibilityGrant>} [partial]
 * @returns {LineupVisibilityGrant}
 */
export function createLineupVisibilityGrant(partial = {}) {
  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    actorId: String(partial.actorId || ""),
    actorRole:
      partial.actorRole != null && String(partial.actorRole).trim() !== ""
        ? String(partial.actorRole).trim()
        : null,
    competitionId: String(partial.competitionId || ""),
    contextId: String(partial.contextId || ""),
    teamId: String(partial.teamId || ""),
    visible: partial.visible === true,
    reason:
      partial.reason != null && String(partial.reason).trim() !== ""
        ? String(partial.reason).trim()
        : null,
    lineupId:
      partial.lineupId != null && String(partial.lineupId).trim() !== ""
        ? String(partial.lineupId).trim()
        : null,
    identityKey:
      partial.identityKey != null && String(partial.identityKey).trim() !== ""
        ? String(partial.identityKey).trim()
        : null,
  });
}
