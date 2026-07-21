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
 * @typedef {Object} FinalizationRequest
 * @property {string} requestId
 * @property {string} resultId
 * @property {string|number} expectedResultVersion
 * @property {string} expectedFingerprint
 * @property {import('./normalizeLifecycleAuthorizationDecision.js').LifecycleAuthorizationDecision} authorizationDecision
 * @property {import('./normalizeHelpers.js').NormalizedTimestamp} finalizedAt
 * @property {string} idempotencyKey
 * @property {string|null} reason
 * @property {string|null} note
 * @property {string|null} correlationId
 * @property {string|null} eventId
 * @property {Readonly<Record<string, unknown>>|null} auditContext
 */

/**
 * Normalize a finalization request. Does not read wall-clock time.
 *
 * @param {unknown} raw
 * @param {{ resultScope: import('./normalizeSeedingScope.js').SeedingScope }} ctx
 * @returns {Readonly<FinalizationRequest>}
 */
export function normalizeFinalizationRequest(raw, ctx) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "FinalizationRequest must be a non-null object"
    );
  }
  if (!ctx || !ctx.resultScope) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "FinalizationRequest normalization requires resultScope"
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

  if (input.finalizedAt == null || input.finalizedAt === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "finalizedAt must be supplied explicitly"
    );
  }
  const finalizedAt = normalizeExplicitTimestamp(input.finalizedAt, "finalizedAt");

  const idempotencyKey =
    normalizeOpaqueId(input.idempotencyKey) || requestId;
  if (!idempotencyKey) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "idempotencyKey is required"
    );
  }

  const authorizationDecision = normalizeLifecycleAuthorizationDecision(
    input.authorizationDecision,
    {
      expectedAction: LIFECYCLE_ACTION.FINALIZE,
      resultScope: ctx.resultScope,
    }
  );

  const reason =
    input.reason == null || input.reason === ""
      ? null
      : String(input.reason);
  const note =
    input.note == null || input.note === "" ? null : String(input.note);
  const correlationId = normalizeOpaqueId(input.correlationId);
  const eventId = normalizeOpaqueId(input.eventId);

  let auditContext = null;
  if (input.auditContext != null) {
    if (typeof input.auditContext !== "object" || Array.isArray(input.auditContext)) {
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
    finalizedAt,
    idempotencyKey,
    reason,
    note,
    correlationId,
    eventId,
    auditContext,
  });
}
