/**
 * Canonical Shared Referee Runtime capability:
 * initializeMatchExecutionState
 *
 * Initializes Referee V5 match_live_states for a canonical match that already
 * exists in Competition / Tournament identity. Does not create match identity.
 * Does not change CORE-13 assignment authority.
 * Does not change Contract #08.
 *
 * Future CORE13 fixture provisioners must call this capability and must not
 * insert match_live_states, promote Team RPC, or duplicate Referee factories.
 */

import { buildRequestHash, hashMatchStateCanonical } from "../persistence/canonicalStateHash.js";
import { validatePersistedMatchState } from "../persistence/validatePersistedState.js";
import { validateStateSchemaVersion } from "../persistence/validateStateSchema.js";
import { authorizeMatchExecutionInit } from "./authorizeMatchExecutionInit.js";
import {
  buildInitialStateFromAdapterB,
  resolveAdapterBEvidence,
} from "./buildInitialStateFromAdapterB.js";
import {
  SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION,
} from "./matchExecutionInitPolicy.js";
import { persistMatchExecutionInit } from "./persistMatchExecutionInit.js";

export async function initializeMatchExecutionState(input = {}) {
  const authorized = authorizeMatchExecutionInit(input);
  if (!authorized.ok) {
    return authorized;
  }

  const evidence = resolveAdapterBEvidence({
    adapter: authorized.adapter,
    adapterRequest: input.adapterRequest,
    tenantId: authorized.tenantId,
    tournamentId: authorized.tournamentId,
    matchId: authorized.matchId,
    competitionMode: authorized.competitionMode,
  });
  if (!evidence.ok) {
    return evidence;
  }

  const factory = buildInitialStateFromAdapterB(evidence.evidence, {
    matchId: authorized.matchId,
  });
  if (!factory.ok) {
    return factory;
  }

  const schema = validateStateSchemaVersion(factory.state);
  if (!schema.ok) {
    return schema;
  }
  const persistedCheck = validatePersistedMatchState(factory.state);
  if (!persistedCheck.ok) {
    return persistedCheck;
  }

  const requestHash = buildRequestHash({
    capabilityId: SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION,
    tenantId: authorized.tenantId,
    tournamentId: authorized.tournamentId,
    matchId: authorized.matchId,
    competitionMode: authorized.competitionMode,
    stateHash: hashMatchStateCanonical(factory.state),
  });

  return persistMatchExecutionInit({
    repository: input.repository,
    rpcClient: input.rpcClient,
    tenantId: authorized.tenantId,
    tournamentId: authorized.tournamentId,
    matchId: authorized.matchId,
    competitionMode: authorized.competitionMode,
    actorId: authorized.actorId,
    idempotencyKey: authorized.idempotencyKey,
    requestHash,
    initialState: factory.state,
    teamAId: factory.teamAId,
    teamBId: factory.teamBId,
  });
}

export { SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION };
