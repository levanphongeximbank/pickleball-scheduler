/**
 * CRM audit and integration event envelopes (Phase 1B contracts; schemaVersion in 1C).
 */

import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { CRM_EVENT_SCHEMA_VERSION, isCrmEventType } from "../constants/eventTypes.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";

function normalizeString(value) {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim();
  return s || null;
}

/**
 * @param {object} input
 * @returns {{ ok: true, event: object } | { ok: false, code: string, error: string }}
 */
export function validateCrmAuditEvent(input) {
  if (!input || typeof input !== "object") {
    return crmFailure(CRM_ERROR_CODES.INVALID_ENVELOPE, "Audit event envelope is required.");
  }

  const tenantId = normalizeString(input.tenantId);
  const venueId = normalizeString(input.venueId);
  if (!tenantId || !venueId) {
    return crmFailure(
      CRM_ERROR_CODES.MISSING_SCOPE,
      "Audit events require tenantId and venueId."
    );
  }

  const eventType = normalizeString(input.eventType);
  if (!eventType || !isCrmEventType(eventType)) {
    return crmFailure(CRM_ERROR_CODES.INVALID_ENVELOPE, "eventType must be a known CRM event type.");
  }

  const eventId = normalizeString(input.eventId);
  if (!eventId) {
    return crmFailure(CRM_ERROR_CODES.INVALID_ENVELOPE, "eventId is required.");
  }

  const occurredAt = normalizeIsoTimestamp(input.occurredAt);
  if (!occurredAt) {
    return crmFailure(CRM_ERROR_CODES.INVALID_ENVELOPE, "occurredAt must be a valid ISO-8601 timestamp.");
  }

  const schemaVersionRaw =
    input.schemaVersion == null ? CRM_EVENT_SCHEMA_VERSION : input.schemaVersion;
  const schemaVersion = Number(schemaVersionRaw);
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return crmFailure(
      CRM_ERROR_CODES.INVALID_ENVELOPE,
      "schemaVersion must be a positive integer."
    );
  }

  return {
    ok: true,
    event: Object.freeze({
      eventId,
      eventType,
      tenantId,
      venueId,
      actorUserId: normalizeString(input.actorUserId),
      aggregateType: normalizeString(input.aggregateType),
      aggregateId: normalizeString(input.aggregateId),
      occurredAt,
      schemaVersion,
      payload:
        input.payload && typeof input.payload === "object" ? Object.freeze({ ...input.payload }) : Object.freeze({}),
    }),
  };
}

/**
 * Integration events request side-effects in other modules (e.g. Notifications).
 * They do not deliver messages themselves.
 *
 * @param {object} input
 * @returns {{ ok: true, event: object } | { ok: false, code: string, error: string }}
 */
export function validateCrmIntegrationEvent(input) {
  const base = validateCrmAuditEvent(input);
  if (!base.ok) return base;

  const idempotencyKey = normalizeString(input.idempotencyKey);
  if (!idempotencyKey) {
    return crmFailure(
      CRM_ERROR_CODES.INVALID_ENVELOPE,
      "Integration events require idempotencyKey."
    );
  }

  return {
    ok: true,
    event: Object.freeze({
      ...base.event,
      idempotencyKey,
      correlationId: normalizeString(input.correlationId),
    }),
  };
}
