import {
  PARTICIPANT_SCHEMA_VERSION,
  createAuditMetadata,
  createFormatExtension,
} from "./shared.js";

/**
 * Competitive subdivision / pool / progression branch (OD-07).
 *
 * @typedef {Object} CompetitionDivision
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} competitionId
 * @property {string} name
 * @property {number|null} [sortOrder]
 * @property {string[]} [categoryIds]
 * @property {string|null} [groupPolicyRef]
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 * @property {import('./shared.js').AuditMetadata} [audit]
 */

/**
 * @param {Partial<CompetitionDivision>} partial
 * @returns {CompetitionDivision}
 */
export function createCompetitionDivision(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    competitionId: String(partial.competitionId || ""),
    name: String(partial.name || ""),
    sortOrder: typeof partial.sortOrder === "number" ? partial.sortOrder : null,
    categoryIds: Array.isArray(partial.categoryIds)
      ? partial.categoryIds.map((id) => String(id))
      : [],
    groupPolicyRef: partial.groupPolicyRef ?? null,
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}

/**
 * Condition classification: age / gender / skill / content (OD-07).
 * Must remain a separate entity from Division.
 *
 * @typedef {Object} CompetitionCategory
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} competitionId
 * @property {string} code
 * @property {string|null} [label]
 * @property {number|null} [playerCount]
 * @property {string|null} [genderPolicyRef]
 * @property {import('./shared.js').FormatExtension|null} [extensions]
 * @property {import('./shared.js').AuditMetadata} [audit]
 */

/**
 * @param {Partial<CompetitionCategory>} partial
 * @returns {CompetitionCategory}
 */
export function createCompetitionCategory(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id: String(partial.id || ""),
    competitionId: String(partial.competitionId || ""),
    code: String(partial.code || ""),
    label: partial.label ?? null,
    playerCount: typeof partial.playerCount === "number" ? partial.playerCount : null,
    genderPolicyRef: partial.genderPolicyRef ?? null,
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}
