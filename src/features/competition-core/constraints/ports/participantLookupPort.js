/**
 * Participant lookup port — CORE-01.
 * Interface / JSDoc only. No persistence schema.
 * Does not import Core-02 participant modules.
 *
 * @typedef {Object} ParticipantLookupPort
 * @property {(ids: string[]) => Promise<Array<{ id: string }>>} getByIds
 */

/**
 * @returns {ParticipantLookupPort}
 */
export function createNullParticipantLookupPort() {
  return {
    async getByIds() {
      return [];
    },
  };
}

/**
 * In-memory stub for unit tests.
 *
 * @param {Array<{ id: string }>} [seed]
 * @returns {ParticipantLookupPort}
 */
export function createInMemoryParticipantLookupPort(seed = []) {
  const byId = new Map(seed.map((item) => [String(item.id), { ...item, id: String(item.id) }]));
  return {
    async getByIds(ids = []) {
      return ids.map((id) => byId.get(String(id))).filter(Boolean);
    },
  };
}
