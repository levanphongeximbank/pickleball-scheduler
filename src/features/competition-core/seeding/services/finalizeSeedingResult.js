import { deepFreeze } from "../domain/deepFreeze.js";
import {
  FINALIZATION_STATE,
  LIFECYCLE_EVENT_TYPE,
} from "../domain/constants.js";
import { normalizeFinalizationRequest } from "../domain/normalizeFinalizationRequest.js";
import { cloneSeedingResultWithLifecycle } from "../domain/cloneSeedingResultWithLifecycle.js";
import { createLifecycleAuditEvent } from "../domain/createLifecycleAuditEvent.js";
import { buildLifecycleEventId } from "../domain/createLifecycleAuditEvent.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";
import { validateSeedingStateTransition } from "./validateSeedingStateTransition.js";
import {
  assertSeedingResultShape,
  assertPolicyAndSnapshotProvenance,
  assertAssignmentInvariants,
  assertResultIdentityMatch,
  assertAuthoritativeResultSemantics,
  authorizationProvenanceFromDecision,
  maybeAppendLifecycleEvents,
  timestampWireValue,
} from "./lifecycleValidation.js";
import {
  invokeSeedingResultRepository,
  requireSeedingResultRepositoryPort,
} from "../ports/SeedingResultRepositoryPort.js";

/**
 * Stable finalization event identity (shared by first finalize and idempotent replay).
 *
 * @param {object} args
 * @returns {string}
 */
function stableFinalizeEventId(args) {
  if (args.eventId) return args.eventId;
  return buildLifecycleEventId({
    eventType: LIFECYCLE_EVENT_TYPE.RESULT_FINALIZED,
    resultId: args.resultId,
    resultVersion: args.resultVersion,
    fingerprint: args.fingerprint,
    previousState: FINALIZATION_STATE.DRAFT,
    nextState: FINALIZATION_STATE.FINALIZED,
    idempotencyKey: args.idempotencyKey,
    requestId: args.requestId,
  });
}

/**
 * Reconstruct the historical FINALIZED transition event for idempotent replay.
 * This is logical history — not a newly appendable audit write.
 *
 * @param {Record<string, unknown>} source
 * @param {import('../domain/normalizeFinalizationRequest.js').FinalizationRequest} request
 * @param {Record<string, unknown>} actorProv
 * @param {Record<string, unknown>} authProv
 */
function historicalFinalizeEvent(source, request, actorProv, authProv) {
  const occurredAt =
    source.finalizedAt != null
      ? timestampWireValue(source.finalizedAt)
      : timestampWireValue(request.finalizedAt);
  return createLifecycleAuditEvent({
    eventId: stableFinalizeEventId({
      eventId: request.eventId,
      resultId: source.resultId,
      resultVersion: source.resultVersion,
      fingerprint: source.deterministicFingerprint,
      idempotencyKey: request.idempotencyKey,
      requestId: String(source.finalizationRequestId || request.requestId),
    }),
    eventType: LIFECYCLE_EVENT_TYPE.RESULT_FINALIZED,
    resultId: source.resultId,
    resultVersion: source.resultVersion,
    seedingScope: source.scope,
    previousState: FINALIZATION_STATE.DRAFT,
    nextState: FINALIZATION_STATE.FINALIZED,
    fingerprint: source.deterministicFingerprint,
    actorProvenance: actorProv,
    authorizationProvenance: authProv,
    occurredAt,
    reasonCodes: [],
    requestId: String(source.finalizationRequestId || request.requestId),
    correlationId: request.correlationId,
    idempotencyKey: String(
      source.finalizationIdempotencyKey || request.idempotencyKey
    ),
  });
}

/**
 * Finalize a DRAFT SeedingResult, or replay an identical FINALIZED request.
 *
 * Return shape:
 * - lifecycleEvents: logical/historical events for the outcome
 * - eventsToAppend: newly appendable events for this invocation only
 * - events: alias of lifecycleEvents (compatibility)
 *
 * Idempotent replay: eventsToAppend is empty and the audit port is not invoked.
 *
 * @param {{
 *   result: object,
 *   request: object,
 *   repositoryPort?: unknown,
 *   auditPort?: unknown,
 *   requireRepositoryPort?: boolean,
 *   requireAuditPort?: boolean,
 *   checkAuthoritativeConflict?: boolean,
 * }} input
 */
export function finalizeSeedingResult(input) {
  if (!input || typeof input !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "finalizeSeedingResult input is required"
    );
  }

  assertSeedingResultShape(input.result);
  const source = /** @type {Record<string, unknown>} */ (input.result);
  const request = normalizeFinalizationRequest(input.request, {
    resultScope: /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
      source.scope
    ),
  });

  assertResultIdentityMatch(source, {
    resultId: request.resultId,
    expectedResultVersion: request.expectedResultVersion,
    expectedFingerprint: request.expectedFingerprint,
  });
  assertPolicyAndSnapshotProvenance(source);
  assertAssignmentInvariants(source);

  const previousState = String(source.finalizationState || "");
  const authProv = authorizationProvenanceFromDecision(
    request.authorizationDecision
  );
  const actorProv = {
    id: request.authorizationDecision.actor.id,
    ...request.authorizationDecision.actor,
  };

  // Idempotent replay: already FINALIZED with matching identity.
  if (previousState === FINALIZATION_STATE.FINALIZED) {
    validateSeedingStateTransition({
      fromState: FINALIZATION_STATE.FINALIZED,
      toState: FINALIZATION_STATE.FINALIZED,
      allowIdempotentFinalizedReplay: true,
    });

    const priorKey = String(source.finalizationIdempotencyKey || "");
    const priorRequestId = String(source.finalizationRequestId || "");
    const priorDecisionId = String(
      /** @type {Record<string, unknown>} */ (
        source.finalizationAuthorization || {}
      ).decisionId || ""
    );
    const priorActorId = String(
      /** @type {Record<string, unknown>} */ (source.finalizationActor || {})
        .id || ""
    );
    const identityMatches =
      priorKey === request.idempotencyKey &&
      (priorRequestId === request.requestId || priorKey === request.requestId) &&
      priorDecisionId === request.authorizationDecision.decisionId &&
      priorActorId === request.authorizationDecision.actor.id &&
      String(source.deterministicFingerprint) ===
        request.expectedFingerprint &&
      String(source.resultVersion) === String(request.expectedResultVersion);

    if (!identityMatches) {
      throwSeedingError(
        SEEDING_ERROR_CODE.RESULT_FINALIZED,
        "Non-idempotent finalization of an already FINALIZED result is rejected",
        {
          resultId: source.resultId,
          idempotencyKey: request.idempotencyKey,
        }
      );
    }

    // Historical event only — do not append again; do not invoke audit port.
    const lifecycleEvents = deepFreeze([
      historicalFinalizeEvent(source, request, actorProv, authProv),
    ]);
    const eventsToAppend = deepFreeze([]);

    const replayed = cloneSeedingResultWithLifecycle(source, {
      finalizationState: FINALIZATION_STATE.FINALIZED,
    });

    return deepFreeze({
      result: replayed,
      lifecycleEvents,
      eventsToAppend,
      events: lifecycleEvents,
      transition: {
        previousState: FINALIZATION_STATE.FINALIZED,
        nextState: FINALIZATION_STATE.FINALIZED,
        idempotent: true,
      },
    });
  }

  validateSeedingStateTransition({
    fromState: previousState,
    toState: FINALIZATION_STATE.FINALIZED,
  });

  // No authoritative result, or same resultId already recorded → ok.
  // A different FINALIZED authoritative result → conflict.
  assertAuthoritativeResultSemantics({
    repositoryPort: input.repositoryPort,
    requireRepositoryPort: input.requireRepositoryPort === true,
    checkAuthoritativeConflict:
      input.checkAuthoritativeConflict === true ||
      input.repositoryPort != null,
    scope: /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
      source.scope
    ),
    allowedResultIds: [source.resultId],
  });

  const finalized = cloneSeedingResultWithLifecycle(source, {
    finalizationState: FINALIZATION_STATE.FINALIZED,
    finalizedAt: request.finalizedAt,
    finalizationActor: deepFreeze(actorProv),
    finalizationAuthorization: deepFreeze(authProv),
    finalizationRequestId: request.requestId,
    finalizationIdempotencyKey: request.idempotencyKey,
  });

  const event = createLifecycleAuditEvent({
    eventId: stableFinalizeEventId({
      eventId: request.eventId,
      resultId: finalized.resultId,
      resultVersion: finalized.resultVersion,
      fingerprint: finalized.deterministicFingerprint,
      idempotencyKey: request.idempotencyKey,
      requestId: request.requestId,
    }),
    eventType: LIFECYCLE_EVENT_TYPE.RESULT_FINALIZED,
    resultId: finalized.resultId,
    resultVersion: finalized.resultVersion,
    seedingScope: finalized.scope,
    previousState: FINALIZATION_STATE.DRAFT,
    nextState: FINALIZATION_STATE.FINALIZED,
    fingerprint: finalized.deterministicFingerprint,
    actorProvenance: actorProv,
    authorizationProvenance: authProv,
    occurredAt: timestampWireValue(request.finalizedAt),
    reasonCodes: [],
    requestId: request.requestId,
    correlationId: request.correlationId,
    idempotencyKey: request.idempotencyKey,
  });

  const eventsToAppend = deepFreeze([event]);
  const appended = /** @type {ReadonlyArray<object>} */ (
    maybeAppendLifecycleEvents(
      input.auditPort,
      input.requireAuditPort === true,
      eventsToAppend
    )
  );
  const lifecycleEvents = deepFreeze(
    appended.length > 0 ? appended : eventsToAppend
  );

  if (input.repositoryPort != null || input.requireRepositoryPort === true) {
    const port = requireSeedingResultRepositoryPort(
      input.repositoryPort,
      true
    );
    invokeSeedingResultRepository(port, "saveFinalized", [finalized]);
  }

  return deepFreeze({
    result: finalized,
    lifecycleEvents,
    eventsToAppend,
    events: lifecycleEvents,
    transition: {
      previousState: FINALIZATION_STATE.DRAFT,
      nextState: FINALIZATION_STATE.FINALIZED,
      idempotent: false,
    },
  });
}
