/**
 * CORE-20 CompetitionAuditSinkPort — append-only port (no SQL / no Identity).
 */

import { createCompetitionAuditEvent } from "../contracts/competitionAuditEvent.js";
import { validateAuditEvent } from "../integrity/validateAuditEvent.js";
import {
  createAuditQueryCriteria,
  matchAuditQuery,
} from "../contracts/auditQuery.js";
import { buildOrderingKey } from "../ordering/streamSequence.js";
import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";

export const COMPETITION_AUDIT_SINK_PORT_METHODS = Object.freeze([
  "append",
  "query",
]);

/**
 * @typedef {Object} CompetitionAuditSinkPort
 * @property {(event: object) => Promise<object>|object} append
 * @property {(criteria: object) => Promise<object[]>|object[]} [query]
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesCompetitionAuditSinkPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ append?: unknown }} */ (port).append === "function"
  );
}

/**
 * Fail-closed null sink — rejects all appends.
 * @returns {CompetitionAuditSinkPort}
 */
export function createNullCompetitionAuditSinkPort() {
  return Object.freeze({
    async append() {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
        "CompetitionAuditSinkPort denied: null/fail-closed double",
        { failClosed: true }
      );
    },
    async query() {
      return [];
    },
  });
}

/**
 * In-memory append-only sink for tests / local doubles.
 * Does not invent wall-clock recordedAt — caller must supply if needed.
 *
 * @returns {CompetitionAuditSinkPort & {
 *   getEvents: () => ReadonlyArray<object>,
 *   getLastSequence: (competitionId: string, streamKey: string) => number|null
 * }}
 */
export function createInMemoryCompetitionAuditSinkPort() {
  /** @type {object[]} */
  const events = [];
  /** @type {Set<string>} */
  const seenIds = new Set();
  /** @type {Map<string, number>} */
  const lastSequenceByOrderingKey = new Map();

  return Object.freeze({
    /**
     * @param {object} partialEvent
     * @returns {Promise<object>}
     */
    async append(partialEvent) {
      const event = createCompetitionAuditEvent(partialEvent);
      validateAuditEvent(event, {
        knownEventIds: seenIds,
        lastSequenceByOrderingKey,
        requireIntegrityFingerprint: true,
      });

      const orderingKey = buildOrderingKey(
        event.competitionScope.competitionId,
        event.streamKey
      );
      seenIds.add(event.eventId);
      lastSequenceByOrderingKey.set(orderingKey, event.sequence);
      events.push(event);
      return event;
    },

    /**
     * @param {object} criteriaPartial
     * @returns {Promise<object[]>}
     */
    async query(criteriaPartial) {
      const criteria = createAuditQueryCriteria(criteriaPartial);
      return [...matchAuditQuery(events, criteria)];
    },

    getEvents() {
      return Object.freeze([...events]);
    },

    getLastSequence(competitionId, streamKey) {
      const key = buildOrderingKey(competitionId, streamKey);
      return lastSequenceByOrderingKey.has(key)
        ? /** @type {number} */ (lastSequenceByOrderingKey.get(key))
        : null;
    },
  });
}
