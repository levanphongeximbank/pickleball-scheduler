import { resolveServeDirection } from "../selectors/serveContextSelector.js";
import { InMemoryMatchRepository } from "./InMemoryMatchRepository.js";
import { RefereeV5AtomicCommitService } from "./RefereeV5AtomicCommitService.js";
import { RefereeV5EdgeCommandHandler } from "./RefereeV5EdgeCommandHandler.js";
import {
  buildMatchStateId,
  deserializeMatchState,
} from "./matchStateSerializer.js";
import {
  REFEREE_V5_ERROR,
  createPersistenceError,
  createPersistenceSuccess,
} from "./errors.js";
import { canReadMatch } from "./refereeV5Authorization.js";

/**
 * Facade for Referee V5 persistence.
 * Mutations route: Edge read/compute → one atomic commit (V5-D.1).
 */
export class RefereeV5PersistenceService {
  constructor(repository = new InMemoryMatchRepository()) {
    this.repository = repository;
    this.atomicCommit = new RefereeV5AtomicCommitService(repository);
    this.edgeHandler = new RefereeV5EdgeCommandHandler(repository, this.atomicCommit);
  }

  async getMatchState({ tenantId, tournamentId, matchId, actor, assignment }) {
    const auth = canReadMatch({ actor, assignment, tenantId });
    if (!auth.ok) {
      return auth;
    }

    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    const live = this.repository.getLiveState(matchStateId);
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }

    const state = deserializeMatchState(live.statePayload);
    const events = this.repository.getEvents(matchStateId).slice(-10);

    return createPersistenceSuccess({
      state,
      stateVersion: live.stateVersion,
      lastEventSequence: live.lastEventSequence,
      recentEvents: events,
      assignment: assignment || null,
      permissions: { canWrite: true, role: auth.role },
      serveDirection: resolveServeDirection(state),
    });
  }

  async applyMatchCommand(input) {
    const accessToken = input.accessToken || `jwt:${input.actor?.userId}`;
    return this.edgeHandler.processMatchCommand({
      accessToken,
      tenantId: input.tenantId,
      tournamentId: input.tournamentId,
      matchId: input.matchId,
      commandType: input.commandType,
      payload: input.payload,
      expectedVersion: input.expectedVersion,
      expectedSequence: input.expectedSequence,
      clientMutationId: input.clientMutationId,
      idempotencyKey: input.idempotencyKey,
      requestBody: input.requestBody || {},
    });
  }

  async verifySnapshotMatchesReplay(matchStateId) {
    return this.edgeHandler.verifySnapshotMatchesReplay(matchStateId);
  }

  async finalizeMatchResult(input) {
    const accessToken = input.accessToken || `jwt:${input.actor?.userId}`;
    return this.edgeHandler.processFinalize({
      accessToken,
      tenantId: input.tenantId,
      tournamentId: input.tournamentId,
      matchId: input.matchId,
      expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey,
      overrideReason: input.overrideReason,
      isOverride: input.isOverride,
      forceComplete: input.forceComplete,
      requestBody: input.requestBody || {},
    });
  }
}

export { InMemoryMatchRepository };
