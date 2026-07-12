import { MATCH_STATUS } from "../constants/eventTypes.js";
import { buildMatchStateId, serializeMatchState, deserializeMatchState } from "./matchStateSerializer.js";
import { hashMatchStateCanonical } from "./canonicalStateHash.js";
import {
  REFEREE_V5_ERROR,
  createPersistenceError,
  createPersistenceSuccess,
} from "./errors.js";
import { canWriteMatch } from "./refereeV5Authorization.js";
import { repoVal } from "./repoAsync.js";

/**
 * Edge path — single PostgreSQL commit RPC (service_role).
 */
export class RefereeV5RpcAtomicCommitService {
  constructor(repository, rpcClient, rpcFns) {
    this.repository = repository;
    this.rpcClient = rpcClient;
    this.rpcFns = rpcFns;
    this.stagingFault = null;
  }

  setStagingFault(fault) {
    this.stagingFault = fault;
  }

  async commitMatchTransition(input) {
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
    const live = await repoVal(this.repository.getLiveState(matchStateId));
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }

    const payload = {
      p_tenant_id: tenantId,
      p_tournament_id: tournamentId,
      p_match_id: matchId,
      p_actor_id: actor.userId,
      p_command_type: commandType,
      p_command_payload: commandPayload,
      p_expected_state_version: expectedStateVersion,
      p_expected_event_sequence: expectedEventSequence,
      p_client_mutation_id: clientMutationId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_next_state: serializeMatchState(nextState),
      p_generated_events: generatedEvents,
      p_state_before_hash: stateBeforeHash,
      p_state_after_hash: stateAfterHash || hashMatchStateCanonical(nextState),
      p_state_before: input.stateBefore ? serializeMatchState(input.stateBefore) : null,
    };

    if (this.stagingFault) {
      payload.p_staging_fault = this.stagingFault;
    }

    const { data, error } = await this.rpcClient.rpc(this.rpcFns.COMMIT_TRANSITION, payload);
    if (error) {
      return createPersistenceError(REFEREE_V5_ERROR.VALIDATION_FAILED, error.message);
    }

    if (data?.ok === false) {
      const retryCached = await repoVal(
        this.repository.findIdempotency(matchStateId, idempotencyKey),
      );
      if (retryCached?.responsePayload) {
        if (retryCached.requestHash && retryCached.requestHash !== requestHash) {
          return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
        }
        return createPersistenceSuccess({ duplicate: true, ...retryCached.responsePayload });
      }
      return createPersistenceError(
        data.code || REFEREE_V5_ERROR.VALIDATION_FAILED,
        data.error,
        {
          currentVersion: data.currentVersion,
          currentSequence: data.currentSequence,
        },
      );
    }

    if (data?.duplicate) {
      const cachedState = data.state ? deserializeMatchState(data.state) : nextState;
      return createPersistenceSuccess({
        duplicate: true,
        state: cachedState,
        stateVersion: data.stateVersion ?? cachedState?.version,
        lastEventSequence: data.lastEventSequence ?? cachedState?.lastEventSequence,
        stateHash: data.stateHash ?? hashMatchStateCanonical(cachedState),
        generatedEvents: data.generatedEvents ?? generatedEvents,
      });
    }

    const committedState = data.state ? deserializeMatchState(data.state) : nextState;
    return createPersistenceSuccess({
      state: committedState,
      stateVersion: data.stateVersion ?? committedState.version,
      lastEventSequence: data.lastEventSequence ?? committedState.lastEventSequence,
      stateHash: data.stateHash ?? hashMatchStateCanonical(committedState),
      generatedEvents: data.generatedEvents ?? generatedEvents,
    });
  }

  async commitMatchFinalization(input) {
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
      outboxEvents = [],
      forceComplete = false,
    } = input;

    const auth = canWriteMatch({ actor, assignment, tenantId });
    if (!auth.ok) {
      return auth;
    }

    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    const live = await repoVal(this.repository.getLiveState(matchStateId));
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }

    const statePayload = live.statePayload;
    const needsComplete =
      live.status !== MATCH_STATUS.COMPLETED &&
      live.status !== MATCH_STATUS.LOCKED &&
      !forceComplete;

    if (needsComplete && statePayload?.status !== MATCH_STATUS.COMPLETED) {
      return createPersistenceError(REFEREE_V5_ERROR.RESULT_NOT_READY);
    }

    const payload = {
      p_tenant_id: tenantId,
      p_tournament_id: tournamentId,
      p_match_id: matchId,
      p_actor_id: actor.userId,
      p_expected_state_version: expectedStateVersion,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_revision: {
        revision: revision.revision,
        status: revision.status,
        teamAId: revision.teamAId || live.teamAId,
        teamBId: revision.teamBId || live.teamBId,
        winnerId: revision.winnerId,
        officialScore: revision.officialScore,
      },
      p_outbox_events: outboxEvents.map((item) => ({
        eventType: item.eventType,
        payload: item.payload || {},
        idempotencyKey: item.idempotencyKey,
      })),
      p_override_reason: overrideReason,
    };

    if (this.stagingFault) {
      payload.p_staging_fault = this.stagingFault;
    }

    const { data, error } = await this.rpcClient.rpc(this.rpcFns.COMMIT_FINALIZATION, payload);
    if (error) {
      return createPersistenceError(REFEREE_V5_ERROR.FINALIZE_FAILED, error.message);
    }

    if (data?.ok === false) {
      return createPersistenceError(data.code || REFEREE_V5_ERROR.FINALIZE_FAILED, data.error);
    }

    if (data?.duplicate) {
      return createPersistenceSuccess({ duplicate: true, locked: true, ...data });
    }

    return createPersistenceSuccess({ locked: true, ...data });
  }
}
