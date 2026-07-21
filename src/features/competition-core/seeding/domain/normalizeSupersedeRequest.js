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
 * @typedef {Object} SupersedeRequest
 * @property {string} requestId
 * @property {string} priorResultId
 * @property {string} replacementResultId
 * @property {import('./normalizeLifecycleAuthorizationDecision.js').LifecycleAuthorizationDecision} authorizationDecision
 * @property {import('./normalizeHelpers.js').NormalizedTimestamp} supersededAt
 * @property {string} idempotencyKey
 * @property {string|null} reason
 * @property {string|null} correlationId
 * @property {string|null} eventId
 * @property {Readonly<Record<string, unknown>>|null} auditContext
 */

/**
 * Normalize a supersede request. Does not read wall-clock time.
 *
 * @param {unknown} raw
 * @param {{ resultScope: import('./normalizeSeedingScope.js').SeedingScope }} ctx
 * @returns {Readonly<SupersedeRequest>}
 */
export function normalizeSupersedeRequest(raw, ctx) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "SupersedeRequest must be a non-null object"
    );
  }
  if (!ctx || !ctx.resultScope) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "SupersedeRequest normalization requires resultScope"
    );
  }

  const input = /** @type {Record<string, unknown>} */ (raw);
  const requestId = normalizeOpaqueId(input.requestId);
  const priorResultId = normalizeOpaqueId(
    input.priorResultId || input.supersededResultId || input.resultId
  );
  const replacementResultId = normalizeOpaqueId(
    input.replacementResultId || input.supersedingResultId
  );
  if (!requestId || !priorResultId || !replacementResultId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "requestId, priorResultId and replacementResultId are required"
    );
  }
  if (priorResultId === replacementResultId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "replacementResultId must differ from priorResultId"
    );
  }

  if (input.supersededAt == null || input.supersededAt === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "supersededAt must be supplied explicitly"
    );
  }
  const supersededAt = normalizeExplicitTimestamp(
    input.supersededAt,
    "supersededAt"
  );

  const idempotencyKey =
    normalizeOpaqueId(input.idempotencyKey) || requestId;

  const authorizationDecision = normalizeLifecycleAuthorizationDecision(
    input.authorizationDecision,
    {
      expectedAction: LIFECYCLE_ACTION.SUPERSEDE,
      resultScope: ctx.resultScope,
    }
  );

  const reason =
    input.reason == null || input.reason === ""
      ? null
      : String(input.reason);
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
    priorResultId,
    replacementResultId,
    authorizationDecision,
    supersededAt,
    idempotencyKey,
    reason,
    correlationId,
    eventId,
    auditContext,
  });
}
