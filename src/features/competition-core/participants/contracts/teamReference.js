import { PARTICIPANT_SCHEMA_VERSION, isNonEmptyString } from "./shared.js";

/**
 * Opaque reference to a CompetitionTeam (or legacy team id).
 * Used by COMPETITION_ENTRY_TYPE.TEAM as an optional compatibility bridge.
 *
 * @typedef {Object} CompetitionTeamReference
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string|null} [competitionId]
 * @property {string|null} [identityKey]
 * @property {string|null} [sourceSystem]
 */

/**
 * @param {Partial<CompetitionTeamReference>|string|null|undefined} partial
 * @returns {CompetitionTeamReference|null}
 */
export function createCompetitionTeamReference(partial) {
  if (partial == null) return null;
  if (typeof partial === "string") {
    const id = partial.trim();
    if (!id) return null;
    return {
      schemaVersion: PARTICIPANT_SCHEMA_VERSION,
      id,
      competitionId: null,
      identityKey: null,
      sourceSystem: null,
    };
  }
  if (typeof partial !== "object" || Array.isArray(partial)) {
    return null;
  }
  const id = String(partial.id || "").trim();
  if (!id) return null;
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id,
    competitionId:
      partial.competitionId != null && String(partial.competitionId).trim() !== ""
        ? String(partial.competitionId).trim()
        : null,
    identityKey:
      partial.identityKey != null && String(partial.identityKey).trim() !== ""
        ? String(partial.identityKey).trim()
        : null,
    sourceSystem:
      partial.sourceSystem != null && String(partial.sourceSystem).trim() !== ""
        ? String(partial.sourceSystem).trim()
        : null,
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCompetitionTeamReference(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return isNonEmptyString(/** @type {{ id?: unknown }} */ (value).id);
}
