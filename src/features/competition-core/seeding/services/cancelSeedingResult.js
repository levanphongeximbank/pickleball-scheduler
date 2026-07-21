import { deepFreeze } from "../domain/deepFreeze.js";
import {
  FINALIZATION_STATE,
  LIFECYCLE_EVENT_TYPE,
} from "../domain/constants.js";
import { normalizeCancellationRequest } from "../domain/normalizeCancellationRequest.js";
import { cloneSeedingResultWithLifecycle } from "../domain/cloneSeedingResultWithLifecycle.js";
import { createLifecycleAuditEvent } from "../domain/createLifecycleAuditEvent.js";
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
  authorizationProvenanceFromDecision,
  maybeAppendLifecycleEvents,
  timestampWireValue,
} from "./lifecycleValidation.js";
import {
  invokeSeedingResultRepository,
  requireSeedingResultRepositoryPort,
} from "../ports/SeedingResultRepositoryPort.js";

/**
 * Cancel a DRAFT SeedingResult. FINALIZED must be superseded, not cancelled.
 * Never mutates caller input. Preserves assignments and fingerprint.
 *
 * @param {{
 *   result: object,
 *   request: object,
 *   repositoryPort?: unknown,
 *   auditPort?: unknown,
 *   requireRepositoryPort?: boolean,
 *   requireAuditPort?: boolean,
 * }} input
 */
export function cancelSeedingResult(input) {
  if (!input || typeof input !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "cancelSeedingResult input is required"
    );
  }

  assertSeedingResultShape(input.result);
  const source = /** @type {Record<string, unknown>} */ (input.result);
  const request = normalizeCancellationRequest(input.request, {
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
  validateSeedingStateTransition({
    fromState: previousState,
    toState: FINALIZATION_STATE.CANCELLED,
  });

  const authProv = authorizationProvenanceFromDecision(
    request.authorizationDecision
  );
  const actorProv = {
    id: request.authorizationDecision.actor.id,
    ...request.authorizationDecision.actor,
  };

  const cancelled = cloneSeedingResultWithLifecycle(source, {
    finalizationState: FINALIZATION_STATE.CANCELLED,
    cancelledAt: request.cancelledAt,
    cancellationReason: request.reason,
    cancellationActor: deepFreeze(actorProv),
    cancellationAuthorization: deepFreeze(authProv),
    cancellationRequestId: request.requestId,
  });

  const event = createLifecycleAuditEvent({
    eventId: request.eventId,
    eventType: LIFECYCLE_EVENT_TYPE.RESULT_CANCELLED,
    resultId: cancelled.resultId,
    resultVersion: cancelled.resultVersion,
    seedingScope: cancelled.scope,
    previousState: FINALIZATION_STATE.DRAFT,
    nextState: FINALIZATION_STATE.CANCELLED,
    fingerprint: cancelled.deterministicFingerprint,
    actorProvenance: actorProv,
    authorizationProvenance: authProv,
    occurredAt: timestampWireValue(request.cancelledAt),
    reasonCodes: ["CANCELLED"],
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
    invokeSeedingResultRepository(port, "saveCancelled", [cancelled]);
  }

  return deepFreeze({
    result: cancelled,
    lifecycleEvents,
    eventsToAppend,
    events: lifecycleEvents,
    transition: {
      previousState: FINALIZATION_STATE.DRAFT,
      nextState: FINALIZATION_STATE.CANCELLED,
      idempotent: false,
    },
  });
}
