import {
  refereeV5EdgeApplyCommand,
  refereeV5EdgeFinalize,
  refereeV5EdgeGetState,
} from "./refereeV5EdgeClient.js";
import { REFEREE_V5_ERROR, createPersistenceError, createPersistenceSuccess } from "../persistence/errors.js";
import { resolveServeDirection } from "../selectors/serveContextSelector.js";

/**
 * Browser-safe remote persistence — Edge Function only.
 */
export class RefereeV5RemoteEdgeService {
  constructor({ accessToken, edgeBaseUrl }) {
    this.accessToken = accessToken;
    this.edgeBaseUrl = edgeBaseUrl;
  }

  async getMatchState({ tournamentId, matchId }) {
    const result = await refereeV5EdgeGetState({
      accessToken: this.accessToken,
      tournamentId,
      matchId,
      edgeBaseUrl: this.edgeBaseUrl,
    });
    if (!result.ok) {
      return result;
    }
    return createPersistenceSuccess({
      state: result.state,
      stateVersion: result.stateVersion,
      lastEventSequence: result.lastEventSequence,
      recentEvents: result.recentEvents || [],
      permissions: { canWrite: true, role: "REFEREE" },
      serveDirection: result.serveDirection || resolveServeDirection(result.state),
      tenantId: result.tenantId,
    });
  }

  async applyMatchCommand(input) {
    const result = await refereeV5EdgeApplyCommand({
      accessToken: this.accessToken,
      edgeBaseUrl: this.edgeBaseUrl,
      tournamentId: input.tournamentId,
      matchId: input.matchId,
      commandType: input.commandType,
      payload: input.payload,
      expectedVersion: input.expectedVersion,
      expectedSequence: input.expectedSequence,
      clientMutationId: input.clientMutationId,
      idempotencyKey: input.idempotencyKey,
    });
    if (!result.ok) {
      return result;
    }
    return createPersistenceSuccess(result);
  }

  async finalizeMatchResult(input) {
    const result = await refereeV5EdgeFinalize({
      accessToken: this.accessToken,
      edgeBaseUrl: this.edgeBaseUrl,
      tournamentId: input.tournamentId,
      matchId: input.matchId,
      expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey,
      overrideReason: input.overrideReason,
      isOverride: input.isOverride,
      forceComplete: input.forceComplete,
    });
    if (!result.ok) {
      return result;
    }
    return createPersistenceSuccess(result);
  }
}

export function createRemoteEdgeService(accessToken, edgeBaseUrl) {
  if (!accessToken) {
    return {
      getMatchState: async () => createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED),
      applyMatchCommand: async () => createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED),
      finalizeMatchResult: async () => createPersistenceError(REFEREE_V5_ERROR.TENANT_ACCESS_DENIED),
    };
  }
  return new RefereeV5RemoteEdgeService({ accessToken, edgeBaseUrl });
}
