import { COMPETITION_PARTICIPANT_STATUS } from "../enums/statuses.js";
import {
  PARTICIPANT_SCHEMA_VERSION,
  createAuditMetadata,
  createFormatExtension,
} from "./shared.js";
import { createParticipantReference, createParticipantSnapshot } from "./identity.js";

/**
 * @typedef {Object} CompetitionParticipant
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} competitionId
 * @property {import('./identity.js').ParticipantReference} person
 * @property {string} status
 * @property {string|null} [displayName]
 * @property {import('./identity.js').ParticipantSnapshot|null} [snapshot]
 * @property {string|null} [registeredByPlatformUserId]
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 * @property {import('./shared.js').AuditMetadata} [audit]
 */

/**
 * @param {Partial<CompetitionParticipant>} partial
 * @returns {CompetitionParticipant}
 */
export function createCompetitionParticipant(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    competitionId: String(partial.competitionId || ""),
    person: createParticipantReference(partial.person || {}),
    status: String(partial.status || COMPETITION_PARTICIPANT_STATUS.DRAFT),
    displayName: partial.displayName ?? null,
    snapshot: partial.snapshot ? createParticipantSnapshot(partial.snapshot) : null,
    registeredByPlatformUserId: partial.registeredByPlatformUserId ?? null,
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}
