import { deepFreeze } from "./deepFreeze.js";
import { LIFECYCLE_ACTION } from "./constants.js";
import { normalizeLifecycleAuthorizationDecision } from "./normalizeLifecycleAuthorizationDecision.js";
import {
  normalizeOpaqueId,
  normalizeExplicitTimestamp,
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";

/**
 * @typedef {Object} CancellationRequest
 * @property {string} requestId
 * @property {string} resultId
 * @property {string|number} expectedResultVersion
 * @property {string} expectedFingerprint
 * @property {import('./normalizeLifecycleAuthorizationDecision.js').LifecycleAuthorizationDecision} authorizationDecision
 * @property {import('./normalizeHelpers.js').NormalizedTimestamp} cancelledAt
 * @property {string} reason
 * @property {string} idempotencyKey
 * @property {string|null} correlationId
 * @property {string|null} eventId
 * @property {Readonly<Record<string, unknown>>|null} auditContext
 */

/**
 * Normalize a cancellation request. Reason is mandatory.
 * Does not read wall-clock time.
 *
 * @param {unknown} raw
 * @param {{ resultScope: import('./normalizeSeedingScope.js').SeedingScope }} ctx
 * @returns {Readonly<CancellationRequest>}
 */
export function normalizeCancellationRequest(raw, ctx) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "CancellationRequest must be a non-null object"
    );
  }
  if (!ctx || !ctx.resultScope) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "CancellationRequest normalization requires resultScope"
    );
  }

  const input = /** @type {Record<string, unknown>} */ (raw);
  const requestId = normalizeOpaqueId(input.requestId);
  const resultId = normalizeOpaqueId(input.resultId);
  if (!requestId || !resultId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "requestId and resultId are required"
    );
  }
  if (input.expectedResultVersion == null || input.expectedResultVersion === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "expectedResultVersion is required"
    );
  }
  const expectedFingerprint = normalizeOpaqueId(input.expectedFingerprint);
  if (!expectedFingerprint) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "expectedFingerprint is required"
    );
  }

  const reasonRaw = input.reason;
  if (reasonRaw == null || String(reasonRaw).trim() === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "cancellation reason is required"
    );
  }
  const reason = String(reasonRaw).trim();

  if (input.cancelledAt == null || input.cancelledAt === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "cancelledAt must be supplied explicitly"
    );
  }
  const cancelledAt = normalizeExplicitTimestamp(
    input.cancelledAt,
    "cancelledAt"
  );

  const idempotencyKey =
    normalizeOpaqueId(input.idempotencyKey) || requestId;

  const authorizationDecision = normalizeLifecycleAuthorizationDecision(
    input.authorizationDecision,
    {
      expectedAction: LIFECYCLE_ACTION.CANCEL,
      resultScope: ctx.resultScope,
    }
  );

  const correlationId = normalizeOpaqueId(input.correlationId);
  const eventId = normalizeOpaqueId(input.eventId);

  let auditContext = null;
  if (input.auditContext != null) {
    if (
      typeof input.auditContext !== "object" ||
      Array.isArray(input.auditContext)
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "auditContext must be an object when provided"
      );
    }
    auditContext = deepFreeze({
      .../** @type {Record<string, unknown>} */ (input.auditContext),
    });
  }

  return deepFreeze({
    requestId,
    resultId,
    expectedResultVersion: input.expectedResultVersion,
    expectedFingerprint,
    authorizationDecision,
    cancelledAt,
    reason,
    idempotencyKey,
    correlationId,
    eventId,
    auditContext,
  });
}
