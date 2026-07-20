/**
 * CORE-06 Phase 1C — IdempotencyPort (command key + payload hash).
 */

/**
 * @typedef {Object} LineupIdempotencyRecord
 * @property {string} key
 * @property {string} payloadHash
 * @property {unknown} [result]
 * @property {string|null} [at]
 */

/**
 * @typedef {Object} LineupIdempotencyLookup
 * @property {boolean} found
 * @property {boolean} [conflict]
 * @property {LineupIdempotencyRecord|null} [record]
 */

/**
 * @typedef {Object} LineupIdempotencyPort
 * @property {(key: string, payloadHash: string) => LineupIdempotencyLookup|Promise<LineupIdempotencyLookup>} lookup
 * @property {(record: LineupIdempotencyRecord) => void|Promise<void>} remember
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesLineupIdempotencyPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof port.lookup === "function" &&
      typeof port.remember === "function"
  );
}

/**
 * @returns {LineupIdempotencyPort}
 */
export function createNoopLineupIdempotencyPort() {
  return {
    async lookup() {
      return { found: false, conflict: false, record: null };
    },
    async remember() {},
  };
}

/**
 * In-memory idempotency for unit tests.
 * @returns {LineupIdempotencyPort}
 */
export function createInMemoryLineupIdempotencyPort() {
  /** @type {Map<string, LineupIdempotencyRecord>} */
  const byKey = new Map();
  return {
    async lookup(key, payloadHash) {
      const existing = byKey.get(String(key));
      if (!existing) {
        return { found: false, conflict: false, record: null };
      }
      if (existing.payloadHash !== String(payloadHash)) {
        return { found: true, conflict: true, record: existing };
      }
      return { found: true, conflict: false, record: existing };
    },
    async remember(record) {
      byKey.set(String(record.key), {
        key: String(record.key),
        payloadHash: String(record.payloadHash),
        result: record.result,
        at: record.at ?? null,
      });
    },
  };
}
