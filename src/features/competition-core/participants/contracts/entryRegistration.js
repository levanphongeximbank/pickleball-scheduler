import { COMPETITION_ENTRY_STATUS } from "../enums/statuses.js";
import {
  PARTICIPANT_SCHEMA_VERSION,
  createAuditMetadata,
  createFormatExtension,
} from "./shared.js";
import { createParticipantReference, createParticipantSnapshot } from "./identity.js";

/**
 * CompetitionEntry always belongs to a competition (OD-03).
 * Waitlist is NOT owned here (OD-10).
 *
 * @typedef {Object} CompetitionEntry
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} competitionId
 * @property {string} status
 * @property {import('./identity.js').ParticipantReference[]} memberRefs
 * @property {string|null} [participantId]
 * @property {string|null} [divisionId]
 * @property {string|null} [categoryId]
 * @property {string|null} [entryRole]
 * @property {string|null} [name]
 * @property {number|null} [seed]
 * @property {import('./identity.js').ParticipantSnapshot|null} [ratingSnapshot]
 * @property {string|null} [groupId]
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 * @property {import('./shared.js').AuditMetadata} [audit]
 */

/**
 * @param {Partial<CompetitionEntry>} partial
 * @returns {CompetitionEntry}
 */
export function createCompetitionEntry(partial = {}) {
  const memberRefs = Array.isArray(partial.memberRefs)
    ? partial.memberRefs.map((ref) => createParticipantReference(ref || {}))
    : [];
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    competitionId: String(partial.competitionId || ""),
    status: String(partial.status || COMPETITION_ENTRY_STATUS.DRAFT),
    memberRefs,
    participantId: partial.participantId ?? null,
    divisionId: partial.divisionId ?? null,
    categoryId: partial.categoryId ?? null,
    entryRole: partial.entryRole ?? null,
    name: partial.name ?? null,
    seed: typeof partial.seed === "number" ? partial.seed : null,
    ratingSnapshot: partial.ratingSnapshot
      ? createParticipantSnapshot(partial.ratingSnapshot)
      : null,
    groupId: partial.groupId ?? null,
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}

/**
 * Registration owns waitlist (OD-10). Waitlisted ≠ active Entry.
 *
 * @typedef {Object} CompetitionRegistration
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} competitionId
 * @property {string} status
 * @property {string|null} [entryId]
 * @property {number|null} [waitlistPosition]
 * @property {string|null} [participantId]
 * @property {string|null} [windowId]
 * @property {string|null} [submittedAt]
 * @property {string|null} [decidedAt]
 * @property {string|null} [decidedBy]
 * @property {string|null} [rejectionReason]
 * @property {string|null} [registeredByPlatformUserId]
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 * @property {import('./shared.js').AuditMetadata} [audit]
 */

/**
 * @param {Partial<CompetitionRegistration>} partial
 * @returns {CompetitionRegistration}
 */
export function createCompetitionRegistration(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    competitionId: String(partial.competitionId || ""),
    status: String(partial.status || "DRAFT"),
    entryId: partial.entryId ?? null,
    waitlistPosition:
      typeof partial.waitlistPosition === "number" ? partial.waitlistPosition : null,
    participantId: partial.participantId ?? null,
    windowId: partial.windowId ?? null,
    submittedAt: partial.submittedAt ?? null,
    decidedAt: partial.decidedAt ?? null,
    decidedBy: partial.decidedBy ?? null,
    rejectionReason: partial.rejectionReason ?? null,
    registeredByPlatformUserId: partial.registeredByPlatformUserId ?? null,
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}

/**
 * @typedef {Object} EligibilityDecision
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} subjectKind
 * @property {string} subjectId
 * @property {string} result
 * @property {string} evaluatedAt
 * @property {string|null} [ruleSetId]
 * @property {Array<Record<string, unknown>>} [violations]
 * @property {Record<string, unknown>|null} [snapshot]
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 */

/**
 * @param {Partial<EligibilityDecision>} partial
 * @returns {EligibilityDecision}
 */
export function createEligibilityDecision(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    subjectKind: String(partial.subjectKind || ""),
    subjectId: String(partial.subjectId || ""),
    result: String(partial.result || "PENDING"),
    evaluatedAt: String(partial.evaluatedAt || ""),
    ruleSetId: partial.ruleSetId ?? null,
    violations: Array.isArray(partial.violations)
      ? partial.violations.map((v) => ({ ...v }))
      : [],
    snapshot:
      partial.snapshot && typeof partial.snapshot === "object" ? { ...partial.snapshot } : null,
    extensions: createFormatExtension(partial.extensions),
  };
}
