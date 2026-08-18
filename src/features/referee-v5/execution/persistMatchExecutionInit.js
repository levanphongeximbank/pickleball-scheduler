import { hashMatchStateCanonical } from "../persistence/canonicalStateHash.js";
import {
  REFEREE_V5_ERROR,
  createPersistenceError,
  createPersistenceSuccess,
} from "../persistence/errors.js";
import {
  deserializeMatchState,
  serializeMatchState,
} from "../persistence/matchStateSerializer.js";
import {
  MATCH_EXECUTION_INIT_RPC,
  SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION,
} from "./matchExecutionInitPolicy.js";

export async function persistMatchExecutionInit({
  repository,
  rpcClient,
  tenantId,
  tournamentId,
  matchId,
  competitionMode,
  actorId,
  idempotencyKey,
  requestHash,
  initialState,
  teamAId,
  teamBId,
}) {
  if (rpcClient && typeof rpcClient.rpc === "function") {
    const { data, error } = await rpcClient.rpc(MATCH_EXECUTION_INIT_RPC, {
      p_tenant_id: tenantId,
      p_tournament_id: tournamentId,
      p_match_id: matchId,
      p_competition_mode: competitionMode,
      p_actor_id: actorId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_initial_state: serializeMatchState(initialState),
      p_team_a_id: teamAId,
      p_team_b_id: teamBId,
    });
    if (error) {
      return createPersistenceError(REFEREE_V5_ERROR.VALIDATION_FAILED, error.message);
    }
    if (data?.ok === false) {
      return createPersistenceError(data.code || REFEREE_V5_ERROR.VALIDATION_FAILED, data.error);
    }
    const state = data?.state ? deserializeMatchState(data.state) : initialState;
    return createPersistenceSuccess({
      capabilityId: SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION,
      initialized: data?.initialized === true,
      alreadyInitialized: data?.alreadyInitialized === true || data?.duplicate === true,
      duplicate: data?.duplicate === true,
      reset: false,
      matchStateId: data?.matchStateId,
      tenantId,
      tournamentId,
      matchId,
      status: data?.status || state?.status,
      stateVersion: Number(data?.stateVersion ?? 0),
      lastEventSequence: Number(data?.lastEventSequence ?? 0),
      state,
      stateHash: data?.stateHash || hashMatchStateCanonical(state),
    });
  }

  if (!repository || typeof repository.initializeExecutionState !== "function") {
    return createPersistenceError(
      REFEREE_V5_ERROR.NOT_CONFIGURED,
      "Shared Referee persistence repository is required."
    );
  }

  return repository.initializeExecutionState({
    tenantId,
    tournamentId,
    matchId,
    initialState,
    teamAId,
    teamBId,
    idempotencyKey,
    requestHash,
    actorId,
    competitionMode,
  });
}
