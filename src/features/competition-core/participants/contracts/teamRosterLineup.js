import {
  COMPETITION_TEAM_STATUS,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_ROSTER_MEMBER_STATUS,
  COMPETITION_LINEUP_STATUS,
} from "../enums/statuses.js";
import {
  PARTICIPANT_SCHEMA_VERSION,
  createAuditMetadata,
  createFormatExtension,
} from "./shared.js";
import { createParticipantReference } from "./identity.js";

/**
 * @typedef {Object} CompetitionTeam
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} competitionId
 * @property {string} name
 * @property {string} status
 * @property {number|null} [seed]
 * @property {import('./identity.js').ParticipantReference|null} [captainRef]
 * @property {import('./identity.js').ParticipantReference[]} [deputyRefs]
 * @property {string|null} [identityKey] — competitionId::TEAM::stableTeamId (Phase 3D)
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 * @property {import('./shared.js').AuditMetadata} [audit]
 */

/**
 * @param {Partial<CompetitionTeam>} partial
 * @returns {CompetitionTeam}
 */
export function createCompetitionTeam(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    competitionId: String(partial.competitionId || ""),
    name: String(partial.name || ""),
    status: String(partial.status || COMPETITION_TEAM_STATUS.DRAFT),
    seed: typeof partial.seed === "number" ? partial.seed : null,
    captainRef: partial.captainRef ? createParticipantReference(partial.captainRef) : null,
    deputyRefs: Array.isArray(partial.deputyRefs)
      ? partial.deputyRefs.map((r) => createParticipantReference(r || {}))
      : [],
    identityKey:
      partial.identityKey != null && partial.identityKey !== ""
        ? String(partial.identityKey)
        : null,
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}

/**
 * @typedef {Object} CompetitionRosterMember
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} rosterId
 * @property {import('./identity.js').ParticipantReference} person
 * @property {string} status
 * @property {string|null} [role]
 * @property {string|null} [joinedAt]
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 */

/**
 * @param {Partial<CompetitionRosterMember>} partial
 * @returns {CompetitionRosterMember}
 */
export function createCompetitionRosterMember(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    rosterId: String(partial.rosterId || ""),
    person: createParticipantReference(partial.person || {}),
    status: String(partial.status || COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE),
    role: partial.role ?? null,
    joinedAt: partial.joinedAt ?? null,
    extensions: createFormatExtension(partial.extensions),
  };
}

/**
 * Substitution / amendment reference (OD-05) — representation only, no runtime workflow.
 *
 * @typedef {Object} RosterSubstitutionReference
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} rosterId
 * @property {import('./identity.js').ParticipantReference} replaced
 * @property {import('./identity.js').ParticipantReference} replacement
 * @property {string} reason
 * @property {string|null} [requestedBy]
 * @property {string|null} [approvedBy]
 * @property {string|null} [effectiveAt]
 * @property {string|null} [eligibilityDecisionId]
 */

/**
 * @param {Partial<RosterSubstitutionReference>} partial
 * @returns {RosterSubstitutionReference}
 */
export function createRosterSubstitutionReference(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    rosterId: String(partial.rosterId || ""),
    replaced: createParticipantReference(partial.replaced || {}),
    replacement: createParticipantReference(partial.replacement || {}),
    reason: String(partial.reason || ""),
    requestedBy: partial.requestedBy ?? null,
    approvedBy: partial.approvedBy ?? null,
    effectiveAt: partial.effectiveAt ?? null,
    eligibilityDecisionId: partial.eligibilityDecisionId ?? null,
  };
}

/**
 * @typedef {Object} CompetitionRoster
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} competitionId
 * @property {string} teamId
 * @property {CompetitionRosterMember[]} members
 * @property {string} status
 * @property {string|null} [lockedAt]
 * @property {string|null} [lockReason]
 * @property {number|null} [maxSize]
 * @property {RosterSubstitutionReference[]} [amendments]
 * @property {string|null} [identityKey] — competitionId::ROSTER::teamId (Phase 3D)
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 * @property {import('./shared.js').AuditMetadata} [audit]
 */

/**
 * @param {Partial<CompetitionRoster>} partial
 * @returns {CompetitionRoster}
 */
export function createCompetitionRoster(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    competitionId: String(partial.competitionId || ""),
    teamId: String(partial.teamId || ""),
    members: Array.isArray(partial.members)
      ? partial.members.map((m) => createCompetitionRosterMember(m || {}))
      : [],
    status: String(partial.status || COMPETITION_ROSTER_STATUS.DRAFT),
    lockedAt: partial.lockedAt ?? null,
    lockReason: partial.lockReason ?? null,
    maxSize: typeof partial.maxSize === "number" ? partial.maxSize : null,
    amendments: Array.isArray(partial.amendments)
      ? partial.amendments.map((a) => createRosterSubstitutionReference(a || {}))
      : [],
    identityKey:
      partial.identityKey != null && partial.identityKey !== ""
        ? String(partial.identityKey)
        : null,
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}

/**
 * @typedef {Object} CompetitionLineupSlot
 * @property {string} id
 * @property {string} disciplineOrSideKey
 * @property {number} index
 * @property {import('./identity.js').ParticipantReference} person
 */

/**
 * Immutable lineup revision (OD-06).
 *
 * @typedef {Object} CompetitionLineupRevision
 * @property {string} schemaVersion
 * @property {string} lineupId
 * @property {number} revision
 * @property {string|null} previousRevisionId
 * @property {string|null} submittedAt
 * @property {string|null} submittedBy
 * @property {string|null} lockedAt
 * @property {string} status
 * @property {CompetitionLineupSlot[]} slots
 * @property {string|null} reason
 */

/**
 * @typedef {Object} CompetitionLineup
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} competitionId
 * @property {string} teamId
 * @property {string} contextId
 * @property {string} status
 * @property {number} revision
 * @property {string|null} [previousRevisionId]
 * @property {string|null} [submittedAt]
 * @property {string|null} [submittedBy]
 * @property {string|null} [lockedAt]
 * @property {string|null} [publishedAt]
 * @property {string|null} [reason]
 * @property {CompetitionLineupSlot[]} slots
 * @property {CompetitionLineupRevision[]} [revisions]
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 * @property {import('./shared.js').AuditMetadata} [audit]
 */

/**
 * @param {Partial<CompetitionLineupSlot>} partial
 * @returns {CompetitionLineupSlot}
 */
export function createCompetitionLineupSlot(partial = {}) {
  return {
    id: String(partial.id || ""),
    disciplineOrSideKey: String(partial.disciplineOrSideKey || ""),
    index: typeof partial.index === "number" ? partial.index : 0,
    person: createParticipantReference(partial.person || {}),
  };
}

/**
 * @param {Partial<CompetitionLineupRevision>} partial
 * @returns {CompetitionLineupRevision}
 */
export function createCompetitionLineupRevision(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    lineupId: String(partial.lineupId || ""),
    revision: typeof partial.revision === "number" ? partial.revision : 0,
    previousRevisionId: partial.previousRevisionId ?? null,
    submittedAt: partial.submittedAt ?? null,
    submittedBy: partial.submittedBy ?? null,
    lockedAt: partial.lockedAt ?? null,
    status: String(partial.status || COMPETITION_LINEUP_STATUS.DRAFT),
    slots: Array.isArray(partial.slots)
      ? partial.slots.map((s) => createCompetitionLineupSlot(s || {}))
      : [],
    reason: partial.reason ?? null,
  };
}

/**
 * @param {Partial<CompetitionLineup>} partial
 * @returns {CompetitionLineup}
 */
export function createCompetitionLineup(partial = {}) {
  const slots = Array.isArray(partial.slots)
    ? partial.slots.map((s) => createCompetitionLineupSlot(s || {}))
    : [];
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    competitionId: String(partial.competitionId || ""),
    teamId: String(partial.teamId || ""),
    contextId: String(partial.contextId || ""),
    status: String(partial.status || COMPETITION_LINEUP_STATUS.DRAFT),
    revision: typeof partial.revision === "number" ? partial.revision : 1,
    previousRevisionId: partial.previousRevisionId ?? null,
    submittedAt: partial.submittedAt ?? null,
    submittedBy: partial.submittedBy ?? null,
    lockedAt: partial.lockedAt ?? null,
    publishedAt: partial.publishedAt ?? null,
    reason: partial.reason ?? null,
    slots,
    revisions: Array.isArray(partial.revisions)
      ? partial.revisions.map((r) => createCompetitionLineupRevision(r || {}))
      : [],
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}
