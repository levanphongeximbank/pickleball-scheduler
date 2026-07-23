/**
 * Player Rating manual adjustment workflow (Phase 1E).
 * Explicit target value only — no increments, no scale conversion, no algorithm.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { requireSupportedRatingMode } from "../contracts/ratingModes.js";
import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import {
  clonePlain,
  deepFreeze,
  failContract,
  isNonEmptyString,
  requireNonEmptyString,
} from "../contracts/shared.js";
import { authorizeAdjustmentActor } from "./authorizeRatingOperation.js";
import {
  buildAdjustmentAuditEntry,
  buildAdjustmentHistoryEntry,
} from "./buildEntries.js";
import {
  ALLOWED_ADJUSTMENT_FIELDS,
  RATING_OPERATION_TYPE,
} from "./constants.js";
import { createRatingOperationIdentity } from "./createRatingOperationIdentity.js";
import {
  assertExpectedVersion,
  assertStateIdentityImmutable,
  buildAfterState,
  fingerprintPayload,
  requireExplicitRatingValue,
} from "./stateHelpers.js";

/**
 * @param {unknown} request
 * @param {{
 *   currentStateAdapter: {
 *     getCurrentState: Function,
 *     preflightOperation: Function,
 *     getOperationRecord: Function,
 *     compareAndSetCurrentState: Function,
 *   },
 *   historyAdapter: { appendHistoryEntry: Function },
 *   auditAdapter: {
 *     recordAdjustmentAudit: Function,
 *     hasAuditOperationId?: Function,
 *     hasAuditId?: Function,
 *   },
 * }} deps
 * @returns {Promise<Readonly<Record<string, unknown>>>}
 */
export async function adjustPlayerRating(request, deps) {
  if (!request || typeof request !== "object") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Adjustment request requires an object",
      { request }
    );
  }
  if (
    !deps?.currentStateAdapter ||
    !deps?.historyAdapter ||
    !deps?.auditAdapter
  ) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
      "Adjustment requires currentStateAdapter, historyAdapter, and auditAdapter",
      {}
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (request);

  if (!isNonEmptyString(raw.playerId)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      "Adjustment requires a non-empty canonical playerId",
      { playerId: raw.playerId }
    );
  }

  const playerId = requireNonEmptyString(raw.playerId, "playerId");
  const scope = requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId);
  const ratingMode = requireSupportedRatingMode(raw.ratingMode);

  const actor = authorizeAdjustmentActor(raw.actor, scope);

  const targetField = requireNonEmptyString(raw.targetField, "targetField");
  if (!ALLOWED_ADJUSTMENT_FIELDS.includes(targetField)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_FIELD_NOT_ALLOWED,
      `Unsupported adjustment target field: ${targetField}`,
      {
        targetField,
        allowed: [...ALLOWED_ADJUSTMENT_FIELDS],
      }
    );
  }

  if (!("newValue" in raw) && !("adjustedRating" in raw)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Adjustment requires explicit newValue (or adjustedRating)",
      { fields: ["newValue", "adjustedRating"] }
    );
  }
  const newValue = requireExplicitRatingValue(
    "newValue" in raw ? raw.newValue : raw.adjustedRating,
    "newValue"
  );

  if (raw.expectedVersion == null) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Adjustment requires expectedVersion",
      { field: "expectedVersion" }
    );
  }
  const expectedVersion = Number(raw.expectedVersion);
  if (!Number.isInteger(expectedVersion)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "expectedVersion must be an integer",
      { expectedVersion: raw.expectedVersion }
    );
  }

  // Reject identity / scope / mode mutation attempts via request overlays.
  if (raw.nextPlayerId != null && String(raw.nextPlayerId) !== playerId) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Identity mutation is forbidden",
      { nextPlayerId: raw.nextPlayerId }
    );
  }
  if (raw.nextScope != null) {
    const nextScope = requireExplicitPlayerRatingScope(raw.nextScope);
    if (
      nextScope.kind !== scope.kind ||
      (scope.kind === "tenant" &&
        nextScope.kind === "tenant" &&
        (nextScope.tenantId !== scope.tenantId ||
          (nextScope.venueId ?? null) !== (scope.venueId ?? null)))
    ) {
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
        "Scope mutation is forbidden",
        { nextScope }
      );
    }
  }
  if (raw.nextRatingMode != null && String(raw.nextRatingMode) !== ratingMode) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Rating mode mutation is forbidden",
      { nextRatingMode: raw.nextRatingMode }
    );
  }

  const auditId = requireNonEmptyString(raw.auditId, "auditId");

  const identity = createRatingOperationIdentity({
    playerId,
    scope,
    ratingMode,
    operationId: actor.operationId,
    operationType: RATING_OPERATION_TYPE.ADJUSTMENT,
  });

  const payloadFingerprint = fingerprintPayload({
    operationType: RATING_OPERATION_TYPE.ADJUSTMENT,
    playerId,
    scope,
    ratingMode,
    targetField,
    newValue,
    expectedVersion,
    actorId: actor.actorId,
    reason: actor.reason,
    correlationId: actor.correlationId,
    occurredAt: actor.occurredAt,
    auditId,
    sourceScale: raw.sourceScale ?? null,
  });

  const preflight = deps.currentStateAdapter.preflightOperation(
    identity,
    payloadFingerprint
  );
  if (preflight === "conflict") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_PAYLOAD_CONFLICT,
      "Conflicting payload for existing adjustment operationId",
      { operationId: actor.operationId }
    );
  }
  if (preflight === "replay") {
    const prior = deps.currentStateAdapter.getOperationRecord(identity);
    return deepFreeze(clonePlain(prior.result));
  }

  if (typeof deps.historyAdapter.getHistoryEntry === "function") {
    try {
      await deps.historyAdapter.getHistoryEntry(actor.operationId);
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_ENTRY_DUPLICATE,
        "History eventId already exists for adjustment operation",
        { eventId: actor.operationId }
      );
    } catch (err) {
      if (
        !(err instanceof Error) ||
        /** @type {{ code?: string }} */ (err).code !==
          PLAYER_RATING_FOUNDATION_ERROR_CODE.HISTORY_ENTRY_NOT_FOUND
      ) {
        throw err;
      }
    }
  }

  if (
    typeof deps.auditAdapter.hasAuditOperationId === "function" &&
    deps.auditAdapter.hasAuditOperationId(actor.operationId)
  ) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_AUDIT_DUPLICATE,
      "Adjustment audit operationId already exists",
      { operationId: actor.operationId }
    );
  }
  if (
    typeof deps.auditAdapter.hasAuditId === "function" &&
    deps.auditAdapter.hasAuditId(auditId)
  ) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_AUDIT_DUPLICATE,
      "Adjustment auditId already exists",
      { auditId }
    );
  }

  const before = await deps.currentStateAdapter.getCurrentState(
    playerId,
    scope,
    ratingMode
  );
  if (!before) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CURRENT_STATE_NOT_FOUND,
      "Adjustment requires an existing current state",
      { playerId, ratingMode }
    );
  }

  assertStateIdentityImmutable(before, playerId, scope, ratingMode);
  assertExpectedVersion(before, expectedVersion);

  let nextSourceScale = before.sourceScale;
  if (raw.sourceScale != null) {
    const requestedScale = requireNonEmptyString(raw.sourceScale, "sourceScale");
    if (requestedScale !== before.sourceScale) {
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SCALE_MISMATCH,
        "Adjustment sourceScale does not match current state scale",
        {
          current: before.sourceScale,
          requested: requestedScale,
        }
      );
    }
    nextSourceScale = requestedScale;
  }

  /** @type {Record<string, unknown>} */
  const patch = {
    [targetField]: newValue,
    source: "manual_adjustment",
    lastEventId: actor.operationId,
    sourceScale: nextSourceScale,
  };
  if (isNonEmptyString(raw.status)) {
    patch.status = String(raw.status).trim();
  }

  const after = buildAfterState(before, patch, actor.occurredAt);

  const historyEntry = buildAdjustmentHistoryEntry({
    eventId: actor.operationId,
    operationId: actor.operationId,
    playerId,
    scope,
    ratingMode,
    beforeState: before,
    afterState: after,
    occurredAt: actor.occurredAt,
    actorId: actor.actorId,
    reason: actor.reason,
    correlationId: actor.correlationId,
    targetField,
  });

  const auditEntry = buildAdjustmentAuditEntry({
    auditId,
    operationId: actor.operationId,
    playerId,
    scope,
    ratingMode,
    actorId: actor.actorId,
    reason: actor.reason,
    beforeState: before,
    afterState: after,
    occurredAt: actor.occurredAt,
    correlationId: actor.correlationId,
  });

  /** @type {Record<string, unknown>} */
  const resultDraft = {
    outcome: "accepted",
    operationType: RATING_OPERATION_TYPE.ADJUSTMENT,
    operationId: actor.operationId,
    auditId,
    playerId,
    scope: clonePlain(scope),
    ratingMode,
    actorId: actor.actorId,
    reason: actor.reason,
    correlationId: actor.correlationId,
    occurredAt: actor.occurredAt,
    targetField,
    newValue,
    sourceScale: after.sourceScale,
    beforeState: clonePlain(before),
    afterState: clonePlain(after),
    historyEventId: historyEntry.eventId,
  };

  const cas = await deps.currentStateAdapter.compareAndSetCurrentState({
    playerId,
    scope,
    ratingMode,
    expectedVersion,
    nextState: after,
    operationIdentity: identity,
    payloadFingerprint,
    result: resultDraft,
  });

  if (!cas.applied) {
    return deepFreeze(clonePlain(cas.result));
  }

  await deps.historyAdapter.appendHistoryEntry(historyEntry);
  await deps.auditAdapter.recordAdjustmentAudit(auditEntry);

  return deepFreeze(clonePlain(cas.result));
}
