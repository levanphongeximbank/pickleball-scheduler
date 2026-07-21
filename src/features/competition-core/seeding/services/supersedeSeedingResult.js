import { deepFreeze } from "../domain/deepFreeze.js";
import {
  FINALIZATION_STATE,
  LIFECYCLE_EVENT_TYPE,
} from "../domain/constants.js";
import { normalizeSupersedeRequest } from "../domain/normalizeSupersedeRequest.js";
import { cloneSeedingResultWithLifecycle } from "../domain/cloneSeedingResultWithLifecycle.js";
import { createLifecycleAuditEvent } from "../domain/createLifecycleAuditEvent.js";
import { buildSeedingScopeKey } from "../domain/normalizeSeedingScope.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";
import { validateSeedingStateTransition } from "./validateSeedingStateTransition.js";
import {
  assertSeedingResultShape,
  assertPolicyAndSnapshotProvenance,
  assertAssignmentInvariants,
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
 * @param {unknown} version
 * @returns {number|null}
 */
function asComparableNumber(version) {
  if (typeof version === "number" && Number.isFinite(version)) {
    return version;
  }
  if (typeof version === "string" && version.trim() !== "") {
    const n = Number(version);
    if (Number.isFinite(n) && String(n) === version.trim()) {
      return n;
    }
  }
  return null;
}

/**
 * Mark a FINALIZED prior result as SUPERSEDED by a FINALIZED replacement.
 * Never edits the prior result in place. Never mutates caller inputs.
 *
 * Preferred sequence (doc 12 + Phase 1E):
 * 1. prior FINALIZED
 * 2. replacement FINALIZED
 * 3. same SeedingScope
 * 4. replacement references supersededResultId
 * 5. distinct identity/version
 * 6. explicit comparable version OR explicit superseding relationship
 * 7. emit SUPERSEDED document + audit
 *
 * @param {{
 *   priorResult: object,
 *   replacementResult: object,
 *   request: object,
 *   repositoryPort?: unknown,
 *   auditPort?: unknown,
 *   requireRepositoryPort?: boolean,
 *   requireAuditPort?: boolean,
 *   checkAuthoritativeConflict?: boolean,
 * }} input
 */
export function supersedeSeedingResult(input) {
  if (!input || typeof input !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "supersedeSeedingResult input is required"
    );
  }

  assertSeedingResultShape(input.priorResult);
  assertSeedingResultShape(input.replacementResult);
  const prior = /** @type {Record<string, unknown>} */ (input.priorResult);
  const replacement =
    /** @type {Record<string, unknown>} */ (input.replacementResult);

  const request = normalizeSupersedeRequest(input.request, {
    resultScope: /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
      prior.scope
    ),
  });

  if (String(prior.resultId) !== request.priorResultId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "priorResult.resultId does not match request.priorResultId"
    );
  }
  if (String(replacement.resultId) !== request.replacementResultId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "replacementResult.resultId does not match request.replacementResultId"
    );
  }

  if (prior.finalizationState !== FINALIZATION_STATE.FINALIZED) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION,
      "Previous result must be FINALIZED before superseding",
      { finalizationState: prior.finalizationState }
    );
  }
  if (replacement.finalizationState !== FINALIZATION_STATE.FINALIZED) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION,
      "Replacement result must be FINALIZED before superseding",
      { finalizationState: replacement.finalizationState }
    );
  }

  validateSeedingStateTransition({
    fromState: FINALIZATION_STATE.FINALIZED,
    toState: FINALIZATION_STATE.SUPERSEDED,
  });

  const priorKey = buildSeedingScopeKey(
    /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
      prior.scope
    )
  );
  const replacementKey = buildSeedingScopeKey(
    /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
      replacement.scope
    )
  );
  if (priorKey !== replacementKey) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SUPERSEDE_SCOPE_MISMATCH,
      "Replacement scope does not match prior SeedingScope",
      { priorScopeKey: priorKey, replacementScopeKey: replacementKey }
    );
  }

  const referenced =
    replacement.supersededResultId ||
    replacement.supersedesResultId ||
    null;
  if (referenced == null || String(referenced) === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.SUPERSEDE_REFERENCE_REQUIRED,
      "Replacement must explicitly reference supersededResultId"
    );
  }
  if (String(referenced) !== String(prior.resultId)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SUPERSEDE_REFERENCE_REQUIRED,
      "Replacement supersededResultId must reference the prior result",
      {
        supersededResultId: referenced,
        priorResultId: prior.resultId,
      }
    );
  }

  if (
    String(prior.resultId) === String(replacement.resultId) &&
    String(prior.resultVersion) === String(replacement.resultVersion)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "Replacement must have a distinct resultId or resultVersion"
    );
  }

  const priorNum = asComparableNumber(prior.resultVersion);
  const replNum = asComparableNumber(replacement.resultVersion);
  if (priorNum != null && replNum != null) {
    if (!(replNum > priorNum)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.RESULT_VERSION_MISMATCH,
        "Replacement resultVersion must be greater than prior when both are numeric",
        {
          priorResultVersion: prior.resultVersion,
          replacementResultVersion: replacement.resultVersion,
        }
      );
    }
  }
  // Non-comparable versions rely on the explicit supersededResultId relationship.

  assertPolicyAndSnapshotProvenance(prior);
  assertPolicyAndSnapshotProvenance(replacement);
  assertAssignmentInvariants(prior);
  assertAssignmentInvariants(replacement);

  // Authoritative semantics (identity-based, not object-reference):
  // - previous FINALIZED result as authoritative is expected (not a conflict)
  // - replacement already authoritative is allowed as same-identity allowance
  // - a third FINALIZED result in the same scope is AUTHORITATIVE_RESULT_CONFLICT
  // - authoritative result from another scope fails closed
  assertAuthoritativeResultSemantics({
    repositoryPort: input.repositoryPort,
    requireRepositoryPort: input.requireRepositoryPort === true,
    checkAuthoritativeConflict:
      input.checkAuthoritativeConflict === true ||
      input.repositoryPort != null,
    scope: /** @type {import('../domain/normalizeSeedingScope.js').SeedingScope} */ (
      prior.scope
    ),
    allowedResultIds: [prior.resultId, replacement.resultId],
  });

  const authProv = authorizationProvenanceFromDecision(
    request.authorizationDecision
  );
  const actorProv = {
    id: request.authorizationDecision.actor.id,
    ...request.authorizationDecision.actor,
  };

  const superseded = cloneSeedingResultWithLifecycle(prior, {
    finalizationState: FINALIZATION_STATE.SUPERSEDED,
    supersededAt: request.supersededAt,
    supersededByResultId: String(replacement.resultId),
    supersedeRequestId: request.requestId,
  });

  // Preserve prior assignments + fingerprint unchanged (clone already does).
  if (
    superseded.deterministicFingerprint !== prior.deterministicFingerprint
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.RESULT_FINGERPRINT_MISMATCH,
      "Supersede clone altered fingerprint"
    );
  }

  const event = createLifecycleAuditEvent({
    eventId: request.eventId,
    eventType: LIFECYCLE_EVENT_TYPE.RESULT_SUPERSEDED,
    resultId: superseded.resultId,
    resultVersion: superseded.resultVersion,
    seedingScope: superseded.scope,
    previousState: FINALIZATION_STATE.FINALIZED,
    nextState: FINALIZATION_STATE.SUPERSEDED,
    fingerprint: superseded.deterministicFingerprint,
    supersededResultId: String(prior.resultId),
    supersededByResultId: String(replacement.resultId),
    actorProvenance: actorProv,
    authorizationProvenance: authProv,
    occurredAt: timestampWireValue(request.supersededAt),
    reasonCodes: request.reason ? ["SUPERSEDED"] : [],
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
    invokeSeedingResultRepository(port, "saveSuperseded", [superseded]);
  }

  return deepFreeze({
    result: superseded,
    replacementResult: replacement,
    lifecycleEvents,
    eventsToAppend,
    events: lifecycleEvents,
    transition: {
      previousState: FINALIZATION_STATE.FINALIZED,
      nextState: FINALIZATION_STATE.SUPERSEDED,
      idempotent: false,
    },
  });
}
