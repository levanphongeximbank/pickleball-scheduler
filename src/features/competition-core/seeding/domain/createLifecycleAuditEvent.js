import { deepFreeze } from "./deepFreeze.js";
import {
  FINALIZATION_STATE_VALUES,
  LIFECYCLE_EVENT_TYPE_VALUES,
} from "./constants.js";
import {
  normalizeOpaqueId,
  normalizeExplicitTimestamp,
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";
import { buildSeedingScopeKey } from "./normalizeSeedingScope.js";

/**
 * @typedef {Object} LifecycleAuditEvent
 * @property {string} eventId
 * @property {string} eventType
 * @property {string} resultId
 * @property {string|number} resultVersion
 * @property {string} seedingScopeKey
 * @property {Readonly<import('./normalizeSeedingScope.js').SeedingScope>} seedingScope
 * @property {string} previousState
 * @property {string} nextState
 * @property {string} fingerprint
 * @property {string|null} supersededResultId
 * @property {string|null} supersededByResultId
 * @property {Readonly<Record<string, unknown>>} actorProvenance
 * @property {Readonly<Record<string, unknown>>} authorizationProvenance
 * @property {import('./normalizeHelpers.js').NormalizedTimestamp} occurredAt
 * @property {ReadonlyArray<string>} reasonCodes
 * @property {string} requestId
 * @property {string|null} correlationId
 * @property {string} idempotencyKey
 */

/**
 * Build a deterministic lifecycle event identity when caller does not supply eventId.
 *
 * Identity inputs (joined):
 * eventType | resultId | resultVersion | fingerprint | previousState | nextState |
 * idempotencyKey | requestId | supersededResultId? | supersededByResultId?
 *
 * @param {object} parts
 * @returns {string}
 */
export function buildLifecycleEventId(parts) {
  const segments = [
    String(parts.eventType || ""),
    String(parts.resultId || ""),
    String(parts.resultVersion ?? ""),
    String(parts.fingerprint || ""),
    String(parts.previousState || ""),
    String(parts.nextState || ""),
    String(parts.idempotencyKey || ""),
    String(parts.requestId || ""),
    String(parts.supersededResultId || ""),
    String(parts.supersededByResultId || ""),
  ];
  return `lifecycle:${segments.join("|")}`;
}

/**
 * Create an immutable lifecycle audit event. occurredAt must be explicit.
 *
 * @param {object} partial
 * @returns {Readonly<LifecycleAuditEvent>}
 */
export function createLifecycleAuditEvent(partial) {
  if (!partial || typeof partial !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "LifecycleAuditEvent partial is required"
    );
  }

  const eventType = normalizeOpaqueId(partial.eventType);
  if (!eventType || !LIFECYCLE_EVENT_TYPE_VALUES.has(eventType)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "eventType is invalid",
      { eventType: partial.eventType }
    );
  }

  const resultId = normalizeOpaqueId(partial.resultId);
  if (!resultId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "resultId is required for lifecycle audit event"
    );
  }
  if (partial.resultVersion == null || partial.resultVersion === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "resultVersion is required for lifecycle audit event"
    );
  }

  const previousState = normalizeOpaqueId(partial.previousState);
  const nextState = normalizeOpaqueId(partial.nextState);
  if (
    !previousState ||
    !nextState ||
    !FINALIZATION_STATE_VALUES.has(previousState) ||
    !FINALIZATION_STATE_VALUES.has(nextState)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "previousState and nextState must be valid finalization states"
    );
  }

  const fingerprint = normalizeOpaqueId(partial.fingerprint);
  if (!fingerprint) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "fingerprint is required for lifecycle audit event"
    );
  }

  if (!partial.seedingScope || typeof partial.seedingScope !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "seedingScope is required for lifecycle audit event"
    );
  }
  const seedingScope = partial.seedingScope;
  const seedingScopeKey =
    normalizeOpaqueId(partial.seedingScopeKey) ||
    buildSeedingScopeKey(seedingScope);

  if (partial.occurredAt == null || partial.occurredAt === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "occurredAt must be supplied explicitly"
    );
  }
  const occurredAt = normalizeExplicitTimestamp(
    partial.occurredAt?.form
      ? partial.occurredAt.value
      : partial.occurredAt,
    "occurredAt"
  );

  const requestId = normalizeOpaqueId(partial.requestId);
  const idempotencyKey = normalizeOpaqueId(partial.idempotencyKey);
  if (!requestId || !idempotencyKey) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "requestId and idempotencyKey are required for lifecycle audit event"
    );
  }

  const eventId =
    normalizeOpaqueId(partial.eventId) ||
    buildLifecycleEventId({
      eventType,
      resultId,
      resultVersion: partial.resultVersion,
      fingerprint,
      previousState,
      nextState,
      idempotencyKey,
      requestId,
      supersededResultId: partial.supersededResultId,
      supersededByResultId: partial.supersededByResultId,
    });

  const reasonCodes = Array.isArray(partial.reasonCodes)
    ? partial.reasonCodes.map((c) => String(c))
    : [];

  return deepFreeze({
    eventId,
    eventType,
    resultId,
    resultVersion: partial.resultVersion,
    seedingScopeKey,
    seedingScope: deepFreeze({ ...seedingScope }),
    previousState,
    nextState,
    fingerprint,
    supersededResultId: normalizeOpaqueId(partial.supersededResultId),
    supersededByResultId: normalizeOpaqueId(partial.supersededByResultId),
    actorProvenance: deepFreeze(
      partial.actorProvenance && typeof partial.actorProvenance === "object"
        ? { ...partial.actorProvenance }
        : {}
    ),
    authorizationProvenance: deepFreeze(
      partial.authorizationProvenance &&
        typeof partial.authorizationProvenance === "object"
        ? { ...partial.authorizationProvenance }
        : {}
    ),
    occurredAt,
    reasonCodes: deepFreeze(reasonCodes),
    requestId,
    correlationId: normalizeOpaqueId(partial.correlationId),
    idempotencyKey,
  });
}
