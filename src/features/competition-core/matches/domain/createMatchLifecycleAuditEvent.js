/**
 * CORE-15 — match-local lifecycle audit event factory.
 * Does not import seeding domain. Does not write platform audit_logs.
 */

import {
  cloneJsonSafe,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";

export const MATCH_LIFECYCLE_EVENT_TYPE = Object.freeze({
  TRANSITION: "MATCH_LIFECYCLE_TRANSITION",
});

/**
 * @typedef {Object} MatchLifecycleAuditEvent
 * @property {string} eventId
 * @property {string} eventType
 * @property {string|null} matchIdentityKey
 * @property {string} previousStatus
 * @property {string} nextStatus
 * @property {string} action
 * @property {Readonly<Record<string, unknown>>} actorProvenance
 * @property {Readonly<Record<string, unknown>>} authorizationProvenance
 * @property {string|null} reason
 * @property {ReadonlyArray<string>} reasonCodes
 * @property {Readonly<Record<string, unknown>>} metadata
 * @property {string} occurredAt
 * @property {string|null} requestId
 * @property {string|null} correlationId
 * @property {string|null} idempotencyKey
 */

/**
 * Deterministic event id when caller does not supply one (no Math.random).
 *
 * @param {object} parts
 * @returns {string}
 */
export function buildMatchLifecycleEventId(parts) {
  const segments = [
    String(parts.eventType || MATCH_LIFECYCLE_EVENT_TYPE.TRANSITION),
    String(parts.matchIdentityKey || ""),
    String(parts.previousStatus || ""),
    String(parts.nextStatus || ""),
    String(parts.action || ""),
    String(parts.occurredAt || ""),
    String(parts.requestId || ""),
    String(parts.idempotencyKey || ""),
  ];
  return `match-lifecycle:${segments.join("|")}`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireIsoTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (isNonEmptyString(value)) {
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return String(value).trim();
  }
  throw new MatchRuntimeError(
    MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
    "occurredAt is required for lifecycle audit events",
    {}
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<MatchLifecycleAuditEvent>}
 */
export function createMatchLifecycleAuditEvent(partial = {}) {
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "Lifecycle audit event partial is required",
      {}
    );
  }

  const eventType = isNonEmptyString(partial.eventType)
    ? String(partial.eventType).trim()
    : MATCH_LIFECYCLE_EVENT_TYPE.TRANSITION;
  const previousStatus = String(partial.previousStatus || "").trim().toUpperCase();
  const nextStatus = String(partial.nextStatus || "").trim().toUpperCase();
  const action = String(partial.action || "").trim();
  const occurredAt = requireIsoTimestamp(partial.occurredAt);

  if (!previousStatus || !nextStatus || !action) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "previousStatus, nextStatus, and action are required",
      { previousStatus, nextStatus, action }
    );
  }

  const matchIdentityKey =
    partial.matchIdentityKey == null || partial.matchIdentityKey === ""
      ? null
      : String(partial.matchIdentityKey);

  const reasonCodes = Array.isArray(partial.reasonCodes)
    ? partial.reasonCodes.map((code) => String(code)).filter(Boolean)
    : [];

  const eventId = isNonEmptyString(partial.eventId)
    ? String(partial.eventId).trim()
    : buildMatchLifecycleEventId({
        eventType,
        matchIdentityKey,
        previousStatus,
        nextStatus,
        action,
        occurredAt,
        requestId: partial.requestId,
        idempotencyKey: partial.idempotencyKey,
      });

  const event = Object.freeze({
    eventId,
    eventType,
    matchIdentityKey,
    previousStatus,
    nextStatus,
    action,
    actorProvenance: Object.freeze(
      partial.actorProvenance &&
        typeof partial.actorProvenance === "object" &&
        !Array.isArray(partial.actorProvenance)
        ? /** @type {Record<string, unknown>} */ (
            cloneJsonSafe(partial.actorProvenance)
          )
        : {}
    ),
    authorizationProvenance: Object.freeze(
      partial.authorizationProvenance &&
        typeof partial.authorizationProvenance === "object" &&
        !Array.isArray(partial.authorizationProvenance)
        ? /** @type {Record<string, unknown>} */ (
            cloneJsonSafe(partial.authorizationProvenance)
          )
        : {}
    ),
    reason:
      partial.reason == null || partial.reason === ""
        ? null
        : String(partial.reason),
    reasonCodes: Object.freeze([...reasonCodes]),
    metadata: Object.freeze(
      partial.metadata &&
        typeof partial.metadata === "object" &&
        !Array.isArray(partial.metadata)
        ? /** @type {Record<string, unknown>} */ (cloneJsonSafe(partial.metadata))
        : {}
    ),
    occurredAt,
    requestId:
      partial.requestId == null || partial.requestId === ""
        ? null
        : String(partial.requestId),
    correlationId:
      partial.correlationId == null || partial.correlationId === ""
        ? null
        : String(partial.correlationId),
    idempotencyKey:
      partial.idempotencyKey == null || partial.idempotencyKey === ""
        ? null
        : String(partial.idempotencyKey),
  });

  return event;
}
