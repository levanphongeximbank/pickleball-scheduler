/**
 * Division lookup port — CORE-01.
 * Interface / JSDoc only. No persistence schema.
 * Does not import Core-04 division/category modules.
 *
 * @typedef {Object} DivisionLookupPort
 * @property {(id: string) => Promise<{ id: string, competitionId?: string, name?: string }|null>} getById
 */

/**
 * @returns {DivisionLookupPort}
 */
export function createNullDivisionLookupPort() {
  return {
    async getById() {
      return null;
    },
  };
}

/**
 * @param {Array<{ id: string, competitionId?: string, name?: string }>} [seed]
 * @returns {DivisionLookupPort}
 */
export function createInMemoryDivisionLookupPort(seed = []) {
  const byId = new Map(
    seed.map((item) => [
      String(item.id),
      {
        id: String(item.id),
        competitionId: item.competitionId != null ? String(item.competitionId) : undefined,
        name: item.name != null ? String(item.name) : undefined,
      },
    ])
  );
  return {
    async getById(id) {
      const found = byId.get(String(id));
      return found ? { ...found } : null;
    },
  };
}
