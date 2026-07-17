import {
  createCompetitionParticipant,
  createCompetitionEntry,
  createCompetitionRegistration,
  createCompetitionTeam,
  createCompetitionRoster,
  createCompetitionLineup,
  createCompetitionDivision,
  createCompetitionCategory,
  PARTICIPANT_SCHEMA_VERSION,
  isJsonSafe,
  cloneJsonSafe,
} from "../contracts/index.js";

/**
 * Versioned JSON-safe DTOs (v1). No React/functions/clients.
 */

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function toJsonDto(value) {
  if (!isJsonSafe(value)) {
    throw new TypeError("DTO payload is not JSON-safe");
  }
  return /** @type {Record<string, unknown>} */ (cloneJsonSafe(value));
}

/**
 * @param {Partial<import('../contracts/competitionParticipant.js').CompetitionParticipant>} partial
 */
export function createParticipantDTOv1(partial = {}) {
  const entity = createCompetitionParticipant(partial);
  return toJsonDto({ ...entity, schemaVersion: PARTICIPANT_SCHEMA_VERSION, dtoType: "ParticipantDTO" });
}

/**
 * @param {Partial<import('../contracts/entryRegistration.js').CompetitionEntry>} partial
 */
export function createEntryDTOv1(partial = {}) {
  const entity = createCompetitionEntry(partial);
  return toJsonDto({ ...entity, schemaVersion: PARTICIPANT_SCHEMA_VERSION, dtoType: "EntryDTO" });
}

/**
 * @param {Partial<import('../contracts/entryRegistration.js').CompetitionRegistration>} partial
 */
export function createRegistrationDTOv1(partial = {}) {
  const entity = createCompetitionRegistration(partial);
  return toJsonDto({
    ...entity,
    schemaVersion: PARTICIPANT_SCHEMA_VERSION,
    dtoType: "RegistrationDTO",
  });
}

/**
 * @param {Partial<import('../contracts/teamRosterLineup.js').CompetitionTeam>} partial
 */
export function createTeamDTOv1(partial = {}) {
  const entity = createCompetitionTeam(partial);
  return toJsonDto({ ...entity, schemaVersion: PARTICIPANT_SCHEMA_VERSION, dtoType: "TeamDTO" });
}

/**
 * @param {Partial<import('../contracts/teamRosterLineup.js').CompetitionRoster>} partial
 */
export function createRosterDTOv1(partial = {}) {
  const entity = createCompetitionRoster(partial);
  return toJsonDto({ ...entity, schemaVersion: PARTICIPANT_SCHEMA_VERSION, dtoType: "RosterDTO" });
}

/**
 * @param {Partial<import('../contracts/teamRosterLineup.js').CompetitionLineup>} partial
 */
export function createLineupDTOv1(partial = {}) {
  const entity = createCompetitionLineup(partial);
  return toJsonDto({ ...entity, schemaVersion: PARTICIPANT_SCHEMA_VERSION, dtoType: "LineupDTO" });
}

/**
 * @param {Partial<import('../contracts/divisionCategory.js').CompetitionDivision>} partial
 */
export function createDivisionDTOv1(partial = {}) {
  const entity = createCompetitionDivision(partial);
  return toJsonDto({ ...entity, schemaVersion: PARTICIPANT_SCHEMA_VERSION, dtoType: "DivisionDTO" });
}

/**
 * @param {Partial<import('../contracts/divisionCategory.js').CompetitionCategory>} partial
 */
export function createCategoryDTOv1(partial = {}) {
  const entity = createCompetitionCategory(partial);
  return toJsonDto({ ...entity, schemaVersion: PARTICIPANT_SCHEMA_VERSION, dtoType: "CategoryDTO" });
}
