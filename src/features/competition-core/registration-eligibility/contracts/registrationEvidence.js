import {
  createAuditMetadata,
  isNonEmptyString,
  REGISTRATION_ELIGIBILITY_SCHEMA_VERSION,
} from "./shared.js";

/**
 * RegistrationEvidence — durable snapshot material for audit / review.
 *
 * @typedef {Object} RegistrationEvidence
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} registrationId
 * @property {string} evidenceType
 * @property {string} capturedAt
 * @property {string|null} [source]
 * @property {Record<string, unknown>} payload
 * @property {import('./shared.js').RegistrationAuditMetadata} [audit]
 */

/**
 * @param {Partial<RegistrationEvidence>} partial
 * @returns {RegistrationEvidence}
 */
export function createRegistrationEvidence(partial = {}) {
  if (!isNonEmptyString(partial.registrationId)) {
    throw new TypeError("RegistrationEvidence requires registrationId");
  }
  if (!isNonEmptyString(partial.evidenceType)) {
    throw new TypeError("RegistrationEvidence requires evidenceType");
  }
  if (!isNonEmptyString(partial.capturedAt)) {
    throw new TypeError("RegistrationEvidence requires capturedAt from ClockPort");
  }
  if (!partial.payload || typeof partial.payload !== "object" || Array.isArray(partial.payload)) {
    throw new TypeError("RegistrationEvidence requires object payload");
  }

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    id: String(partial.id || ""),
    registrationId: String(partial.registrationId).trim(),
    evidenceType: String(partial.evidenceType).trim(),
    capturedAt: String(partial.capturedAt).trim(),
    source:
      partial.source != null && String(partial.source).trim() !== ""
        ? String(partial.source).trim()
        : null,
    payload: { ...partial.payload },
    audit: createAuditMetadata(partial.audit),
  });
}

/**
 * RegistrationAuditEvent — append-only lifecycle / decision event.
 *
 * @typedef {Object} RegistrationAuditEvent
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} registrationId
 * @property {string} eventType
 * @property {string} occurredAt
 * @property {string|null} [actorId]
 * @property {string|null} [fromStatus]
 * @property {string|null} [toStatus]
 * @property {string|null} [decisionId]
 * @property {string|null} [eligibilityDecisionId]
 * @property {string|null} [competitionId] — Phase 1B additive
 * @property {string|null} [operation] — Phase 1B lifecycle operation name
 * @property {string|null} [requestId] — originating registrationRequestId or command requestId
 * @property {string|null} [correlationId]
 * @property {string|null} [reason]
 * @property {string|null} [serviceVersion]
 * @property {Record<string, unknown>|null} [payload]
 */

/**
 * @param {Partial<RegistrationAuditEvent>} partial
 * @returns {RegistrationAuditEvent}
 */
export function createRegistrationAuditEvent(partial = {}) {
  if (!isNonEmptyString(partial.registrationId)) {
    throw new TypeError("RegistrationAuditEvent requires registrationId");
  }
  if (!isNonEmptyString(partial.eventType)) {
    throw new TypeError("RegistrationAuditEvent requires eventType");
  }
  if (!isNonEmptyString(partial.occurredAt)) {
    throw new TypeError("RegistrationAuditEvent requires occurredAt from ClockPort");
  }

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    id: String(partial.id || ""),
    registrationId: String(partial.registrationId).trim(),
    eventType: String(partial.eventType).trim(),
    occurredAt: String(partial.occurredAt).trim(),
    actorId:
      partial.actorId != null && String(partial.actorId).trim() !== ""
        ? String(partial.actorId).trim()
        : null,
    fromStatus:
      partial.fromStatus != null && String(partial.fromStatus).trim() !== ""
        ? String(partial.fromStatus).trim()
        : null,
    toStatus:
      partial.toStatus != null && String(partial.toStatus).trim() !== ""
        ? String(partial.toStatus).trim()
        : null,
    decisionId:
      partial.decisionId != null && String(partial.decisionId).trim() !== ""
        ? String(partial.decisionId).trim()
        : null,
    eligibilityDecisionId:
      partial.eligibilityDecisionId != null &&
      String(partial.eligibilityDecisionId).trim() !== ""
        ? String(partial.eligibilityDecisionId).trim()
        : null,
    competitionId:
      partial.competitionId != null && String(partial.competitionId).trim() !== ""
        ? String(partial.competitionId).trim()
        : null,
    operation:
      partial.operation != null && String(partial.operation).trim() !== ""
        ? String(partial.operation).trim()
        : null,
    requestId:
      partial.requestId != null && String(partial.requestId).trim() !== ""
        ? String(partial.requestId).trim()
        : null,
    correlationId:
      partial.correlationId != null && String(partial.correlationId).trim() !== ""
        ? String(partial.correlationId).trim()
        : null,
    reason:
      partial.reason != null && String(partial.reason).trim() !== ""
        ? String(partial.reason).trim()
        : null,
    serviceVersion:
      partial.serviceVersion != null && String(partial.serviceVersion).trim() !== ""
        ? String(partial.serviceVersion).trim()
        : null,
    payload:
      partial.payload && typeof partial.payload === "object" && !Array.isArray(partial.payload)
        ? { ...partial.payload }
        : null,
  });
}
