/**
 * RegistrationAuditPort — append-only audit sink.
 *
 * @typedef {Object} RegistrationAuditPort
 * @property {(event: import('../contracts/registrationEvidence.js').RegistrationAuditEvent) => Promise<void>} append
 * @property {(registrationId: string) => Promise<import('../contracts/registrationEvidence.js').RegistrationAuditEvent[]>} [listByRegistration]
 */

/**
 * @returns {RegistrationAuditPort}
 */
export function createNullRegistrationAuditPort() {
  return {
    async append() {
      /* no-op */
    },
    async listByRegistration() {
      return [];
    },
  };
}

/**
 * In-memory audit sink for tests.
 * @returns {RegistrationAuditPort & { _events: import('../contracts/registrationEvidence.js').RegistrationAuditEvent[] }}
 */
export function createInMemoryRegistrationAuditPort() {
  /** @type {import('../contracts/registrationEvidence.js').RegistrationAuditEvent[]} */
  const events = [];
  return {
    _events: events,
    async append(event) {
      if (!event || typeof event !== "object") {
        throw new TypeError("append requires RegistrationAuditEvent");
      }
      events.push(event);
    },
    async listByRegistration(registrationId) {
      const id = String(registrationId || "");
      return events.filter((e) => e.registrationId === id);
    },
  };
}

export const REGISTRATION_AUDIT_PORT_METHODS = Object.freeze([
  "append",
  "listByRegistration",
]);
