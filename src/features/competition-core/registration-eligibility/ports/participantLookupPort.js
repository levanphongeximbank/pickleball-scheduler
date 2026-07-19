/**
 * ParticipantLookupPort — Core-02 adjacent read; local interface only.
 *
 * @typedef {Object} ParticipantLookupPort
 * @property {(ids: string[]) => Promise<Array<{ id: string, status?: string, [k: string]: unknown }>>} getByIds
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
 * @param {Array<{ id: string, [k: string]: unknown }>} [seed]
 * @returns {ParticipantLookupPort}
 */
export function createInMemoryParticipantLookupPort(seed = []) {
  const byId = new Map(
    seed.map((item) => [String(item.id), { ...item, id: String(item.id) }])
  );
  return {
    async getByIds(ids = []) {
      return ids.map((id) => byId.get(String(id))).filter(Boolean);
    },
  };
}

export const PARTICIPANT_LOOKUP_PORT_METHODS = Object.freeze(["getByIds"]);
