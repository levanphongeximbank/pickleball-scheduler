/**
 * EntryLookupPort — Core-02 adjacent read; local interface only.
 *
 * @typedef {Object} EntryLookupPort
 * @property {(competitionId: string) => Promise<Array<{ id: string, competitionId: string, [k: string]: unknown }>>} getByCompetition
 * @property {(identityKey: string) => Promise<{ id: string, competitionId: string, [k: string]: unknown }|null>} [findByIdentityKey]
 */

/**
 * @returns {EntryLookupPort}
 */
export function createNullEntryLookupPort() {
  return {
    async getByCompetition() {
      return [];
    },
    async findByIdentityKey() {
      return null;
    },
  };
}

/**
 * @param {Array<{ id: string, competitionId: string, identityKey?: string, [k: string]: unknown }>} [seed]
 * @returns {EntryLookupPort}
 */
export function createInMemoryEntryLookupPort(seed = []) {
  const rows = seed.map((item) => ({
    ...item,
    id: String(item.id),
    competitionId: String(item.competitionId),
  }));
  return {
    async getByCompetition(competitionId) {
      const id = String(competitionId || "");
      return rows.filter((row) => row.competitionId === id).map((row) => ({ ...row }));
    },
    async findByIdentityKey(identityKey) {
      const key = String(identityKey || "");
      if (!key) return null;
      return rows.find((row) => row.identityKey === key) ?? null;
    },
  };
}

export const ENTRY_LOOKUP_PORT_METHODS = Object.freeze([
  "getByCompetition",
  "findByIdentityKey",
]);
