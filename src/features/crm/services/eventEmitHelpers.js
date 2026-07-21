/**
 * Build CRM audit / integration envelopes (Phase 1C — MODEL 1).
 *
 * Commands validate and return pending event envelopes.
 * Dispatch is deferred to a later adapter/phase.
 * No active port emission here — avoids ambiguous persisted state.
 */

import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { CRM_EVENT_SCHEMA_VERSION } from "../constants/eventTypes.js";
import {
  validateCrmAuditEvent,
  validateCrmIntegrationEvent,
} from "../models/events.js";

/**
 * @param {object} params
 * @param {object} params.scope
 * @param {string} params.eventType
 * @param {string} params.aggregateType
 * @param {string} params.aggregateId
 * @param {string} params.actorUserId
 * @param {string} params.occurredAt
 * @param {object} [params.payload]
 * @param {{ nextId: (prefix: string) => string }} params.ids
 * @returns {{ ok: true, event: object } | { ok: false, code: string, error: string }}
 */
export function buildCrmAuditEvent({
  scope,
  eventType,
  aggregateType,
  aggregateId,
  actorUserId,
  occurredAt,
  payload = {},
  ids,
}) {
  return validateCrmAuditEvent({
    eventId: ids.nextId("evt"),
    eventType,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    aggregateType,
    aggregateId,
    actorUserId,
    occurredAt,
    schemaVersion: CRM_EVENT_SCHEMA_VERSION,
    payload,
  });
}

/**
 * @param {object} params
 * @param {object} params.scope
 * @param {string} params.eventType
 * @param {string} params.aggregateType
 * @param {string} params.aggregateId
 * @param {string} params.actorUserId
 * @param {string} params.occurredAt
 * @param {string} params.idempotencyKey
 * @param {string|null} [params.correlationId]
 * @param {object} [params.payload]
 * @param {{ nextId: (prefix: string) => string }} params.ids
 * @returns {{ ok: true, event: object } | { ok: false, code: string, error: string }}
 */
export function buildCrmIntegrationEvent({
  scope,
  eventType,
  aggregateType,
  aggregateId,
  actorUserId,
  occurredAt,
  idempotencyKey,
  correlationId = null,
  payload = {},
  ids,
}) {
  return validateCrmIntegrationEvent({
    eventId: ids.nextId("ievt"),
    eventType,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    aggregateType,
    aggregateId,
    actorUserId,
    occurredAt,
    schemaVersion: CRM_EVENT_SCHEMA_VERSION,
    idempotencyKey,
    correlationId,
    payload,
  });
}

/**
 * @param {unknown} err
 * @returns {{ ok: false, code: string, error: string, details?: object }}
 */
export function toCrmFailure(err) {
  if (err && typeof err === "object" && err.code && err.message) {
    return crmFailure(err.code, err.message, err.details);
  }
  return crmFailure(
    CRM_ERROR_CODES.INVALID_INPUT,
    err?.message || "CRM command failed."
  );
}
