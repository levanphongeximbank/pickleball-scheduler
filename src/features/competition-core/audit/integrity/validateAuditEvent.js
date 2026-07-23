/**
 * CORE-20 — integrity validation for CompetitionAuditEvent (+ stream checks).
 */

import { COMPETITION_AUDIT_EVENT_VERSION } from "../constants.js";
import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";
import { isAuditEventType } from "../enums/auditEventTypes.js";
import { isActorKind } from "../enums/actorKinds.js";
import { isSubjectType } from "../enums/subjectTypes.js";
import {
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
} from "../utils/helpers.js";
import { createAuditContentFingerprint } from "./contentFingerprint.js";
import { assertNextSequence } from "../ordering/streamSequence.js";
import { isProhibitedAuditKey } from "../redaction/sanitizeAuditPayload.js";

/**
 * @param {unknown} event
 * @param {{ requireCorrelation?: boolean, requireIntegrityFingerprint?: boolean, knownEventIds?: ReadonlySet<string>, lastSequenceByOrderingKey?: ReadonlyMap<string, number> }} [options]
 * @returns {Readonly<object>}
 */
export function validateAuditEvent(event, options = {}) {
  if (!isPlainObject(event)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "Audit event must be a plain object",
      {}
    );
  }

  if (!isNonEmptyString(event.eventId)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "eventId is required",
      {}
    );
  }
  if (!isAuditEventType(event.eventType)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "Invalid eventType",
      { eventType: event.eventType }
    );
  }
  if (event.eventVersion !== COMPETITION_AUDIT_EVENT_VERSION) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INCOMPATIBLE_VERSION,
      "Incompatible eventVersion",
      { eventVersion: event.eventVersion }
    );
  }
  if (!isNonEmptyString(event.occurredAt)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "occurredAt is required",
      {}
    );
  }
  if (
    !isPlainObject(event.competitionScope) ||
    !isNonEmptyString(event.competitionScope.competitionId)
  ) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "competitionScope.competitionId is required",
      {}
    );
  }
  if (!isNonEmptyString(event.streamKey)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "streamKey is required",
      {}
    );
  }
  if (!isPositiveInteger(event.sequence)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_SEQUENCE,
      "sequence must be a positive integer",
      { sequence: event.sequence }
    );
  }
  if (
    !isPlainObject(event.source) ||
    !isNonEmptyString(event.source.capability) ||
    !isNonEmptyString(event.source.moduleId)
  ) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "source.capability and source.moduleId are required",
      {}
    );
  }
  if (!isPlainObject(event.actor) || !isActorKind(event.actor.actorKind)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_ACTOR,
      "actor.actorKind is invalid",
      { actor: event.actor }
    );
  }
  if (
    !isPlainObject(event.subject) ||
    !isSubjectType(event.subject.subjectType) ||
    !isNonEmptyString(event.subject.subjectId)
  ) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_SUBJECT,
      "subject is invalid",
      { subject: event.subject }
    );
  }

  if (options.requireCorrelation && !isNonEmptyString(event.correlationId)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_MISSING_CORRELATION,
      "correlationId is required for this validation policy",
      { eventId: event.eventId }
    );
  }

  if (
    event.causationId != null &&
    event.causationId !== "" &&
    event.causationId === event.eventId
  ) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_CAUSATION,
      "causationId must not equal eventId",
      { causationId: event.causationId }
    );
  }

  if (options.knownEventIds?.has(String(event.eventId))) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_DUPLICATE_EVENT_ID,
      "Duplicate eventId",
      { eventId: event.eventId }
    );
  }

  const orderingKey =
    isNonEmptyString(event.orderingKey)
      ? String(event.orderingKey)
      : `${event.competitionScope.competitionId}|${event.streamKey}`;

  if (options.lastSequenceByOrderingKey) {
    const last = options.lastSequenceByOrderingKey.get(orderingKey);
    assertNextSequence(last ?? null, event.sequence);
  }

  assertNoProhibitedKeys(event.safePayload, "safePayload");
  assertNoProhibitedKeys(event.explanationMetadata, "explanationMetadata");
  assertNoProhibitedKeys(event.beforeSummary, "beforeSummary");
  assertNoProhibitedKeys(event.afterSummary, "afterSummary");

  if (options.requireIntegrityFingerprint !== false) {
    const expected = createAuditContentFingerprint(event);
    const actual = event.integrityMetadata?.contentFingerprint;
    if (!isNonEmptyString(actual)) {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_INTEGRITY_MISMATCH,
        "integrityMetadata.contentFingerprint is required",
        { eventId: event.eventId }
      );
    }
    if (String(actual) !== expected) {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_INTEGRITY_MISMATCH,
        "contentFingerprint mismatch",
        { eventId: event.eventId, expected, actual }
      );
    }
  }

  return /** @type {Readonly<object>} */ (event);
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function assertNoProhibitedKeys(value, label) {
  if (value == null) return;
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (isProhibitedAuditKey(key)) {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_PROHIBITED_CONTENT,
        `${label} contains prohibited key`,
        { key, label }
      );
    }
  }
}
