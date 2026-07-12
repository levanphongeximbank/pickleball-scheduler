import { MATCH_STATUS } from "../constants/eventTypes.js";
import { buildAuditEntry } from "./auditLog.js";
import { buildRequestHash, hashMatchStateCanonical } from "./canonicalStateHash.js";
import {
  buildCommandEventRecord,
} from "./InMemoryMatchRepository.js";
import {
  buildMatchStateId,
  deserializeMatchState,
  serializeMatchState,
} from "./matchStateSerializer.js";
import {
  REFEREE_V5_ERROR,
  createPersistenceError,
  createPersistenceSuccess,
} from "./errors.js";
import { canWriteMatch } from "./refereeV5Authorization.js";
import { validateCommitTransition } from "./validateStateSchema.js";

/**
 * Internal atomic commit — simulates referee_v5_commit_match_transition.
 * All DB mutations occur inside one row-lock transaction scope.
 */
export class RefereeV5AtomicCommitService {
  constructor(repository) {
    this.repository = repository;
    this.commitCallCount = 0;
    this.finalizeCommitCallCount = 0;
  }

  async commitMatchTransition(input) {
    this.commitCallCount += 1;

    const {
      tenantId,
      tournamentId,
      matchId,
      actor,
      assignment,
      expectedStateVersion,
      expectedEventSequence,
      clientMutationId,
      idempotencyKey,
      requestHash,
      commandType,
      commandPayload = {},
      nextState,
      generatedEvents = [],
      stateBeforeHash,
      stateAfterHash,
    } = input;

    const auth = canWriteMatch({ actor, assignment, tenantId });
    if (!auth.ok) {
      return auth;
    }

    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });

    return this.repository.atomicTransaction(matchStateId, async () => {
      const dbAssignment = this.repository.getAssignment({
        tenantId,
        tournamentId,
        matchId,
        userId: actor.userId,
      });

      if (!dbAssignment || dbAssignment.status !== "active") {
        return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
      }

      if (dbAssignment.expiresAt && new Date(dbAssignment.expiresAt).getTime() < Date.now()) {
        return createPersistenceError(REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED);
      }

      const cached = this.repository.findIdempotency(matchStateId, idempotencyKey);
      if (cached) {
        if (cached.requestHash && requestHash && cached.requestHash !== requestHash) {
          return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
        }
        if (cached.responsePayload) {
          return createPersistenceSuccess({ duplicate: true, ...cached.responsePayload });
        }
      }

      const live = this.repository.getLiveState(matchStateId);
      if (!live) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
      }

      if (live.status === MATCH_STATUS.LOCKED) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_LOCKED);
      }

      if (Number(expectedStateVersion) !== Number(live.stateVersion)) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_STATE_CONFLICT, undefined, {
          currentVersion: live.stateVersion,
          currentSequence: live.lastEventSequence,
        });
      }

      if (Number(expectedEventSequence) !== Number(live.lastEventSequence)) {
        return createPersistenceError(REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT, undefined, {
          currentVersion: live.stateVersion,
          currentSequence: live.lastEventSequence,
        });
      }

      const transitionCheck = validateCommitTransition({
        liveRow: live,
        matchId,
        beforeVersion: live.stateVersion,
        beforeSequence: live.lastEventSequence,
        nextState,
      });
      if (!transitionCheck.ok) {
        return transitionCheck;
      }

      const command = {
        eventId: clientMutationId || `cmd-${Date.now()}`,
        eventType: commandType,
        sequence: Number(expectedEventSequence) + 1,
        expectedVersion: Number(expectedStateVersion),
        actorId: actor.userId,
        clientMutationId,
        idempotencyKey,
        payload: commandPayload,
      };

      const eventRecord = buildCommandEventRecord({
        matchStateId,
        tenantId,
        tournamentId,
        matchId,
        command,
        beforeVersion: live.stateVersion,
        afterVersion: nextState.version,
        beforeHash: stateBeforeHash,
        afterHash: stateAfterHash,
        generatedEvents,
        actorRole: auth.role,
      });

      const responsePayload = {
        state: nextState,
        stateVersion: nextState.version,
        lastEventSequence: nextState.lastEventSequence,
        generatedEvents,
        stateHash: stateAfterHash || hashMatchStateCanonical(nextState),
      };

      const commit = this.repository.appendEventAndSnapshot({
        matchStateId,
        eventRecord,
        nextState,
        idempotencyRecord: {
          matchId: matchStateId,
          idempotencyKey,
          clientMutationId,
          commandType,
          requestHash,
          status: "applied",
          resultingEventSequence: command.sequence,
          resultingStateVersion: nextState.version,
          responsePayload,
        },
      });

      if (!commit.ok) {
        return commit;
      }

      this.repository.appendAudit(
        buildAuditEntry({
          tenantId,
          tournamentId,
          matchId,
          actorId: actor.userId,
          actorRole: auth.role,
          commandType,
          beforeVersion: live.stateVersion,
          afterVersion: nextState.version,
        })
      );

      return createPersistenceSuccess(responsePayload);
    });
  }

  async commitMatchFinalization(input) {
    this.finalizeCommitCallCount += 1;

    const {
      tenantId,
      tournamentId,
      matchId,
      actor,
      assignment,
      expectedStateVersion,
      idempotencyKey,
      requestHash,
      revision,
      overrideReason = null,
      isOverride = false,
      outboxEvents = [],
    } = input;

    if (isOverride && !overrideReason) {
      return createPersistenceError(REFEREE_V5_ERROR.OVERRIDE_REASON_REQUIRED);
    }

    const auth = canWriteMatch({ actor, assignment, tenantId });
    if (!auth.ok) {
      return auth;
    }

    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    const finalizeKey = `finalize::${idempotencyKey}`;

    return this.repository.atomicTransaction(matchStateId, async () => {
      const cached = this.repository.findIdempotency(matchStateId, finalizeKey);
      if (cached) {
        if (cached.requestHash && requestHash && cached.requestHash !== requestHash) {
          return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
        }
        if (cached.responsePayload) {
          return createPersistenceSuccess({ duplicate: true, ...cached.responsePayload });
        }
      }

      const live = this.repository.getLiveState(matchStateId);
      if (!live) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
      }

      if (Number(expectedStateVersion) !== Number(live.stateVersion)) {
        return createPersistenceError(REFEREE_V5_ERROR.MATCH_STATE_CONFLICT, undefined, {
          currentVersion: live.stateVersion,
        });
      }

      const state = deserializeMatchState(live.statePayload);
      if (state.status !== MATCH_STATUS.COMPLETED && !input.forceComplete) {
        return createPersistenceError(REFEREE_V5_ERROR.RESULT_NOT_READY);
      }

      const saved = this.repository.saveResultRevision(revision);
      if (!saved.ok && !saved.duplicate) {
        return createPersistenceError(REFEREE_V5_ERROR.FINALIZE_FAILED);
      }

      this.repository.lockLiveState(matchStateId, actor.userId);

      for (const outbox of outboxEvents) {
        this.repository.appendOutbox({
          ...outbox,
          tenantId,
          tournamentId,
          matchId,
          idempotencyKey: outbox.idempotencyKey || `${finalizeKey}::${outbox.eventType}`,
        });
      }

      const responsePayload = {
        revision: saved.revision || revision,
        locked: true,
        outboxCount: outboxEvents.length,
      };

      this.repository.saveIdempotency({
        matchId: matchStateId,
        idempotencyKey: finalizeKey,
        clientMutationId: idempotencyKey,
        commandType: isOverride ? "OVERRIDE_RESULT" : "FINALIZE_MATCH",
        requestHash,
        status: "applied",
        responsePayload,
      });

      this.repository.appendAudit(
        buildAuditEntry({
          tenantId,
          tournamentId,
          matchId,
          actorId: actor.userId,
          actorRole: auth.role,
          commandType: isOverride ? "OVERRIDE_RESULT" : "FINALIZE_MATCH",
          beforeVersion: live.stateVersion,
          afterVersion: live.stateVersion,
          reason: overrideReason,
        })
      );

      return createPersistenceSuccess(responsePayload);
    });
  }
}

export function buildCommandRequestHash({
  commandType,
  payload,
  clientMutationId,
}) {
  return buildRequestHash({
    commandType,
    payload: payload || {},
    clientMutationId,
  });
}

export function stampStateSchema(state) {
  return {
    ...serializeMatchState(state),
    stateSchemaVersion: state.stateSchemaVersion ?? 1,
  };
}
