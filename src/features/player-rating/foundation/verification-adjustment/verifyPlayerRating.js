/**
 * Player Rating verification workflow (Phase 1E).
 * Runtime-neutral. No scale conversion. No match-result algorithm.
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
import { authorizeVerificationActor } from "./authorizeRatingOperation.js";
import { buildVerificationHistoryEntry } from "./buildEntries.js";
import { RATING_OPERATION_TYPE } from "./constants.js";
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
 *   historyAdapter: { appendHistoryEntry: Function, listHistory?: Function },
 * }} deps
 * @returns {Promise<Readonly<Record<string, unknown>>>}
 */
export async function verifyPlayerRating(request, deps) {
  if (!request || typeof request !== "object") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Verification request requires an object",
      { request }
    );
  }
  if (!deps?.currentStateAdapter || !deps?.historyAdapter) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
      "Verification requires currentStateAdapter and historyAdapter",
      {}
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (request);

  if (!isNonEmptyString(raw.playerId)) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED,
      "Verification requires a non-empty canonical playerId",
      { playerId: raw.playerId }
    );
  }

  const playerId = requireNonEmptyString(raw.playerId, "playerId");
  const scope = requireExplicitPlayerRatingScope(raw.scope ?? raw.tenantId);
  const ratingMode = requireSupportedRatingMode(raw.ratingMode);

  const actor = authorizeVerificationActor(raw.actor, scope);

  let verifiedRating;
  if ("verifiedRating" in raw) {
    verifiedRating = requireExplicitRatingValue(raw.verifiedRating, "verifiedRating");
  } else if ("verifiedSourceValue" in raw) {
    verifiedRating = requireExplicitRatingValue(
      raw.verifiedSourceValue,
      "verifiedSourceValue"
    );
  } else {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Verification requires verifiedRating or verifiedSourceValue",
      { fields: ["verifiedRating", "verifiedSourceValue"] }
    );
  }

  if (raw.expectedVersion == null) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Verification requires expectedVersion",
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

  const identity = createRatingOperationIdentity({
    playerId,
    scope,
    ratingMode,
    operationId: actor.operationId,
    operationType: RATING_OPERATION_TYPE.VERIFICATION,
  });

  const payloadFingerprint = fingerprintPayload({
    operationType: RATING_OPERATION_TYPE.VERIFICATION,
    playerId,
    scope,
    ratingMode,
    verifiedRating,
    expectedVersion,
    actorId: actor.actorId,
    reason: actor.reason,
    correlationId: actor.correlationId,
    occurredAt: actor.occurredAt,
    sourceScale: raw.sourceScale ?? null,
  });

  const preflight = deps.currentStateAdapter.preflightOperation(
    identity,
    payloadFingerprint
  );
  if (preflight === "conflict") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_PAYLOAD_CONFLICT,
      "Conflicting payload for existing verification operationId",
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
        "History eventId already exists for verification operation",
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

  const before = await deps.currentStateAdapter.getCurrentState(
    playerId,
    scope,
    ratingMode
  );
  if (!before) {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.CURRENT_STATE_NOT_FOUND,
      "Verification requires an existing current state",
      { playerId, ratingMode }
    );
  }

  assertStateIdentityImmutable(before, playerId, scope, ratingMode);
  assertExpectedVersion(before, expectedVersion);

  if (raw.sourceScale != null) {
    const requestedScale = requireNonEmptyString(raw.sourceScale, "sourceScale");
    if (requestedScale !== before.sourceScale) {
      failContract(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SCALE_MISMATCH,
        "Verification sourceScale does not match current state scale",
        {
          current: before.sourceScale,
          requested: requestedScale,
        }
      );
    }
  }

  const after = buildAfterState(
    before,
    {
      verifiedRating,
      status: isNonEmptyString(raw.status) ? String(raw.status).trim() : "verified",
      source: "verification",
      lastEventId: actor.operationId,
    },
    actor.occurredAt
  );

  const historyEntry = buildVerificationHistoryEntry({
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
  });

  /** @type {Record<string, unknown>} */
  const resultDraft = {
    outcome: "accepted",
    operationType: RATING_OPERATION_TYPE.VERIFICATION,
    operationId: actor.operationId,
    playerId,
    scope: clonePlain(scope),
    ratingMode,
    actorId: actor.actorId,
    reason: actor.reason,
    correlationId: actor.correlationId,
    occurredAt: actor.occurredAt,
    verifiedRating,
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

  return deepFreeze(clonePlain(cas.result));
}
