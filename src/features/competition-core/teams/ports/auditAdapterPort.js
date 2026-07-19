/**
 * Core-05 — audit adapter port.
 * Safe no-op allowed only after the domain operation has completed.
 */

/**
 * @typedef {Object} TeamAuditEvent
 * @property {string} type
 * @property {string|null} [teamId]
 * @property {string|null} [rosterId]
 * @property {string|null} [actor]
 * @property {Record<string, unknown>} [payload]
 * @property {string} [at]
 */

/**
 * @typedef {Object} TeamAuditAdapter
 * @property {(event: TeamAuditEvent) => void|Promise<void>} record
 */

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function matchesAuditAdapter(adapter) {
  return Boolean(adapter && typeof adapter === "object" && typeof adapter.record === "function");
}

/**
 * @returns {TeamAuditAdapter}
 */
export function createNoopAuditAdapter() {
  return {
    async record() {},
  };
}

/**
 * @param {(event: TeamAuditEvent) => void|Promise<void>} handler
 * @returns {TeamAuditAdapter}
 */
export function createAuditAdapter(handler) {
  return {
    async record(event) {
      await handler(event);
    },
  };
}
