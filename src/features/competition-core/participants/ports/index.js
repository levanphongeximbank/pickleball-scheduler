/**
 * Repository port interfaces — no persistence adapter, SQL, HTTP gateway,
 * or browser storage implementations in this phase.
 *
 * These are structural contracts. Adapters may implement them in later phases.
 */

/**
 * @typedef {Object} ParticipantRepositoryPort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(participant: unknown) => Promise<unknown>} save
 * @property {(ref: { kind: string, id: string }, competitionId: string) => Promise<unknown|null>} findByExternalReference
 */

/**
 * @typedef {Object} EntryRepositoryPort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(entry: unknown) => Promise<unknown>} save
 * @property {(scope: { competitionId: string, divisionId?: string|null, categoryId?: string|null, entryRole?: string|null }) => Promise<unknown[]>} findActiveDuplicate
 */

/**
 * @typedef {Object} RegistrationRepositoryPort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(registration: unknown) => Promise<unknown>} save
 */

/**
 * @typedef {Object} TeamRepositoryPort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(team: unknown) => Promise<unknown>} save
 */

/**
 * @typedef {Object} RosterRepositoryPort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(roster: unknown) => Promise<unknown>} save
 * @property {(roster: unknown) => Promise<unknown>} saveRevision
 */

/**
 * @typedef {Object} LineupRepositoryPort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(lineup: unknown) => Promise<unknown>} save
 * @property {(revision: unknown) => Promise<unknown>} saveRevision
 */

/**
 * @typedef {Object} DivisionRepositoryPort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(division: unknown) => Promise<unknown>} save
 */

/**
 * @typedef {Object} CategoryRepositoryPort
 * @property {(id: string) => Promise<unknown|null>} getById
 * @property {(competitionId: string) => Promise<unknown[]>} listByCompetition
 * @property {(category: unknown) => Promise<unknown>} save
 */

export const PARTICIPANT_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "findByExternalReference",
]);

export const ENTRY_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "findActiveDuplicate",
]);

export const REGISTRATION_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
]);

export const TEAM_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
]);

export const ROSTER_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "saveRevision",
]);

export const LINEUP_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "saveRevision",
]);

export const DIVISION_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
]);

export const CATEGORY_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
]);

/**
 * @param {unknown} port
 * @param {readonly string[]} methods
 * @returns {boolean}
 */
export function matchesRepositoryPortShape(port, methods) {
  if (!port || typeof port !== "object") return false;
  return methods.every((name) => typeof port[name] === "function");
}

/**
 * In-memory fake adapter for contract tests only — not a Production persistence adapter.
 * @returns {ParticipantRepositoryPort & EntryRepositoryPort}
 */
export function createInMemoryParticipantPorts() {
  /** @type {Map<string, unknown>} */
  const participants = new Map();
  /** @type {Map<string, unknown>} */
  const entries = new Map();

  return {
    async getById(id) {
      return participants.get(String(id)) ?? entries.get(String(id)) ?? null;
    },
    async listByCompetition(competitionId) {
      return [...participants.values()].filter(
        (p) => p && typeof p === "object" && p.competitionId === competitionId
      );
    },
    async save(participant) {
      participants.set(String(participant.id), participant);
      return participant;
    },
    async findByExternalReference(ref, competitionId) {
      for (const p of participants.values()) {
        if (
          p &&
          typeof p === "object" &&
          p.competitionId === competitionId &&
          p.person?.kind === ref.kind &&
          p.person?.id === ref.id
        ) {
          return p;
        }
      }
      return null;
    },
    async findActiveDuplicate(scope) {
      return [...entries.values()].filter((e) => {
        if (!e || typeof e !== "object") return false;
        if (e.competitionId !== scope.competitionId) return false;
        if ((e.divisionId ?? null) !== (scope.divisionId ?? null)) return false;
        if ((e.categoryId ?? null) !== (scope.categoryId ?? null)) return false;
        if ((e.entryRole ?? null) !== (scope.entryRole ?? null)) return false;
        return e.status === "ACTIVE" || e.status === "APPROVED";
      });
    },
    async saveEntry(entry) {
      entries.set(String(entry.id), entry);
      return entry;
    },
  };
}
