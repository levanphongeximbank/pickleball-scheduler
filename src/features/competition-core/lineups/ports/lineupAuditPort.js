/**
 * CORE-06 Phase 1C — AuditPort (append-only action log contract).
 */

/**
 * @typedef {Object} LineupAuditEvent
 * @property {string} type
 * @property {string|null} [lineupId]
 * @property {string|null} [identityKey]
 * @property {string|null} [actorId]
 * @property {string|null} [actorRole]
 * @property {string|null} [action]
 * @property {string|null} [fromStatus]
 * @property {string|null} [toStatus]
 * @property {number|null} [revision]
 * @property {string|null} [reason]
 * @property {string|null} [idempotencyKey]
 * @property {string|null} [at]
 * @property {Record<string, unknown>} [payload]
 */

/**
 * @typedef {Object} LineupAuditPort
 * @property {(event: LineupAuditEvent) => void|Promise<void>} append
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesLineupAuditPort(port) {
  return Boolean(
    port && typeof port === "object" && typeof port.append === "function"
  );
}

/**
 * Safe no-op after successful domain ops (tests / dormant wiring).
 * @returns {LineupAuditPort}
 */
export function createNoopLineupAuditPort() {
  return {
    async append() {},
  };
}

/**
 * @param {(event: LineupAuditEvent) => void|Promise<void>} handler
 * @returns {LineupAuditPort}
 */
export function createLineupAuditPort(handler) {
  return {
    async append(event) {
      await handler(event);
    },
  };
}
