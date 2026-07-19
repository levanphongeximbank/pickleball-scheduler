/**
 * Entry lookup port — CORE-01.
 * Interface / JSDoc only. No persistence schema.
 * Does not import Core-02 registration modules.
 *
 * @typedef {Object} EntryLookupPort
 * @property {(competitionId: string) => Promise<Array<{ id: string, competitionId: string }>>} getByCompetition
 */

/**
 * @returns {EntryLookupPort}
 */
export function createNullEntryLookupPort() {
  return {
    async getByCompetition() {
      return [];
    },
  };
}

/**
 * @param {Array<{ id: string, competitionId: string }>} [seed]
 * @returns {EntryLookupPort}
 */
export function createInMemoryEntryLookupPort(seed = []) {
  const rows = seed.map((item) => ({
    id: String(item.id),
    competitionId: String(item.competitionId),
  }));
  return {
    async getByCompetition(competitionId) {
      const id = String(competitionId || "");
      return rows.filter((row) => row.competitionId === id).map((row) => ({ ...row }));
    },
  };
}
