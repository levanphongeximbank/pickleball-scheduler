/**
 * EntryCreationPort — conversion handoff from APPROVED registration → Core-02 Entry.
 * Core-03 does not persist Entry; it requests creation through this port.
 *
 * @typedef {Object} EntryCreationRequest
 * @property {string} registrationId
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {import('../contracts/registrationTarget.js').RegistrationTarget} target
 * @property {string|null} [idempotencyKey]
 * @property {Record<string, unknown>|null} [metadata]
 */

/**
 * @typedef {Object} EntryCreationResult
 * @property {boolean} ok
 * @property {string|null} [entryId]
 * @property {string|null} [errorCode]
 * @property {string|null} [message]
 */

/**
 * @typedef {Object} EntryCreationPort
 * @property {(request: EntryCreationRequest) => Promise<EntryCreationResult>} createEntryFromRegistration
 */

/**
 * @returns {EntryCreationPort}
 */
export function createNullEntryCreationPort() {
  return {
    async createEntryFromRegistration() {
      return {
        ok: false,
        entryId: null,
        errorCode: "ENTRY_CREATION_PORT_UNAVAILABLE",
        message: "EntryCreationPort not configured (fail closed)",
      };
    },
  };
}

/**
 * In-memory stub for tests — NOT Production persistence.
 * @returns {EntryCreationPort & { _created: EntryCreationRequest[] }}
 */
export function createInMemoryEntryCreationPort() {
  /** @type {EntryCreationRequest[]} */
  const created = [];
  let n = 0;
  return {
    _created: created,
    async createEntryFromRegistration(request) {
      if (!request?.registrationId || !request?.competitionId || !request?.target) {
        return {
          ok: false,
          entryId: null,
          errorCode: "MISSING_IDENTIFIER",
          message: "registrationId, competitionId, and target are required",
        };
      }
      n += 1;
      const entryId = `entry-${String(n).padStart(4, "0")}`;
      created.push({ ...request });
      return { ok: true, entryId, errorCode: null, message: null };
    },
  };
}

export const ENTRY_CREATION_PORT_METHODS = Object.freeze([
  "createEntryFromRegistration",
]);
