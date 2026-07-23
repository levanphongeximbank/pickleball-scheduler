import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";
import { isAuditEventType } from "../enums/auditEventTypes.js";
import {
  isNonEmptyString,
  isPlainObject,
  isNonNegativeInteger,
  deepFreezeClone,
} from "../utils/helpers.js";
import { createCompetitionScope } from "./competitionScope.js";

/**
 * @typedef {Object} AuditQueryCriteria
 * @property {Readonly<{ competitionId: string, seasonId?: string|null, clubId?: string|null, divisionId?: string|null }>} competitionScope
 * @property {ReadonlyArray<string>} [eventTypes]
 * @property {string|null} [actorId]
 * @property {string|null} [actorKind]
 * @property {string|null} [subjectType]
 * @property {string|null} [subjectId]
 * @property {string|null} [correlationId]
 * @property {string|null} [streamKey]
 * @property {string|null} [occurredAtFrom]
 * @property {string|null} [occurredAtTo]
 * @property {number|null} [sequenceFrom]
 * @property {number|null} [sequenceTo]
 * @property {string|null} [cursor]
 * @property {number} [limit]
 * @property {boolean} [redactionAware]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<AuditQueryCriteria>}
 */
export function createAuditQueryCriteria(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_QUERY_INVALID,
      "AuditQueryCriteria must be a plain object",
      {}
    );
  }

  const competitionScope = createCompetitionScope(partial.competitionScope);

  const eventTypes = Array.isArray(partial.eventTypes)
    ? partial.eventTypes.map((t) => String(t).trim()).filter(Boolean)
    : [];
  for (const eventType of eventTypes) {
    if (!isAuditEventType(eventType)) {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_QUERY_INVALID,
        "Invalid eventType in query criteria",
        { eventType }
      );
    }
  }

  let limit = 50;
  if (partial.limit != null) {
    if (!isNonNegativeInteger(partial.limit) || partial.limit < 1) {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_QUERY_INVALID,
        "limit must be a positive integer",
        { limit: partial.limit }
      );
    }
    limit = Math.min(partial.limit, 500);
  }

  const sequenceFrom =
    partial.sequenceFrom == null ? null : Number(partial.sequenceFrom);
  const sequenceTo =
    partial.sequenceTo == null ? null : Number(partial.sequenceTo);
  if (sequenceFrom != null && !isNonNegativeInteger(sequenceFrom)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_QUERY_INVALID,
      "sequenceFrom must be a non-negative integer",
      { sequenceFrom: partial.sequenceFrom }
    );
  }
  if (sequenceTo != null && !isNonNegativeInteger(sequenceTo)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_QUERY_INVALID,
      "sequenceTo must be a non-negative integer",
      { sequenceTo: partial.sequenceTo }
    );
  }

  return Object.freeze(
    /** @type {AuditQueryCriteria} */ (
      deepFreezeClone({
        competitionScope,
        eventTypes: Object.freeze([...eventTypes]),
        actorId: isNonEmptyString(partial.actorId)
          ? String(partial.actorId).trim()
          : null,
        actorKind: isNonEmptyString(partial.actorKind)
          ? String(partial.actorKind).trim()
          : null,
        subjectType: isNonEmptyString(partial.subjectType)
          ? String(partial.subjectType).trim()
          : null,
        subjectId: isNonEmptyString(partial.subjectId)
          ? String(partial.subjectId).trim()
          : null,
        correlationId: isNonEmptyString(partial.correlationId)
          ? String(partial.correlationId).trim()
          : null,
        streamKey: isNonEmptyString(partial.streamKey)
          ? String(partial.streamKey).trim()
          : null,
        occurredAtFrom: isNonEmptyString(partial.occurredAtFrom)
          ? String(partial.occurredAtFrom).trim()
          : null,
        occurredAtTo: isNonEmptyString(partial.occurredAtTo)
          ? String(partial.occurredAtTo).trim()
          : null,
        sequenceFrom,
        sequenceTo,
        cursor: isNonEmptyString(partial.cursor)
          ? String(partial.cursor).trim()
          : null,
        limit,
        redactionAware: partial.redactionAware !== false,
      })
    )
  );
}

/**
 * @param {ReadonlyArray<object>} events
 * @param {AuditQueryCriteria} criteria
 * @returns {ReadonlyArray<object>}
 */
export function matchAuditQuery(events, criteria) {
  const list = Array.isArray(events) ? events : [];
  const filtered = list.filter((event) => {
    if (!event || typeof event !== "object") return false;
    if (
      event.competitionScope?.competitionId !==
      criteria.competitionScope.competitionId
    ) {
      return false;
    }
    if (
      criteria.eventTypes.length > 0 &&
      !criteria.eventTypes.includes(event.eventType)
    ) {
      return false;
    }
    if (criteria.actorId != null && event.actor?.actorId !== criteria.actorId) {
      return false;
    }
    if (
      criteria.actorKind != null &&
      event.actor?.actorKind !== criteria.actorKind
    ) {
      return false;
    }
    if (
      criteria.subjectType != null &&
      event.subject?.subjectType !== criteria.subjectType
    ) {
      return false;
    }
    if (
      criteria.subjectId != null &&
      event.subject?.subjectId !== criteria.subjectId
    ) {
      return false;
    }
    if (
      criteria.correlationId != null &&
      event.correlationId !== criteria.correlationId
    ) {
      return false;
    }
    if (criteria.streamKey != null && event.streamKey !== criteria.streamKey) {
      return false;
    }
    if (
      criteria.occurredAtFrom != null &&
      String(event.occurredAt) < criteria.occurredAtFrom
    ) {
      return false;
    }
    if (
      criteria.occurredAtTo != null &&
      String(event.occurredAt) > criteria.occurredAtTo
    ) {
      return false;
    }
    if (criteria.sequenceFrom != null && event.sequence < criteria.sequenceFrom) {
      return false;
    }
    if (criteria.sequenceTo != null && event.sequence > criteria.sequenceTo) {
      return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (a.streamKey !== b.streamKey) {
      return String(a.streamKey).localeCompare(String(b.streamKey));
    }
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return String(a.eventId).localeCompare(String(b.eventId));
  });

  let start = 0;
  if (criteria.cursor) {
    const idx = filtered.findIndex((e) => e.eventId === criteria.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }
  return Object.freeze(filtered.slice(start, start + criteria.limit));
}
