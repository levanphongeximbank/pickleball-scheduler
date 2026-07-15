import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../constants/eventTypes.js";
import { dispatchMatchCommand } from "../engines/matchCommandDispatcher.js";
import { STATE_SCHEMA_VERSION } from "../constants/stateSchema.js";
import {
  RefereeV5AtomicCommitService,
  buildCommandRequestHash,
} from "./RefereeV5AtomicCommitService.js";
import {
  buildMatchStateId,
  deserializeMatchState,
} from "./matchStateSerializer.js";
import { hashMatchStateCanonical } from "./canonicalStateHash.js";
import {
  REFEREE_V5_ERROR,
  createPersistenceError,
  createPersistenceSuccess,
  mapEngineErrorToPersistence,
} from "./errors.js";
import {
  deriveUserIdFromVerifiedToken,
  rejectClientIdentityFields,
  resolveTrustedActor,
} from "./refereeV5TrustBoundary.js";
import { validateMatchCommandPayload } from "./validateCommandPayload.js";
import { repoVal } from "./repoAsync.js";

const OUTBOX_EVENT_TYPES = Object.freeze([
  "BRACKET_ADVANCE_REQUESTED",
  "STANDINGS_RECALC_REQUESTED",
  "NOTIFICATION_REQUESTED",
  "RATING_EVIDENCE_REQUESTED",
]);

/**
 * Edge Function read/compute phase — no DB writes until one atomic commit call.
 */
export class RefereeV5EdgeCommandHandler {
  constructor(repository, atomicCommit = new RefereeV5AtomicCommitService(repository)) {
    this.repository = repository;
    this.atomicCommit = atomicCommit;
  }

  async processMatchCommand({
    accessToken,
    tournamentId,
    matchId,
    commandType,
    payload = {},
    expectedVersion,
    expectedSequence,
    clientMutationId,
    idempotencyKey,
    requestBody = {},
  }) {
    rejectClientIdentityFields(requestBody);

    const tokenResult = deriveUserIdFromVerifiedToken(accessToken);
    if (!tokenResult.ok) {
      return tokenResult;
    }

    const assignmentLookup = await repoVal(
      this.repository.findAssignmentByUserAndMatch({
        userId: tokenResult.userId,
        tournamentId,
        matchId,
      }),
    );
    if (!assignmentLookup) {
      return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
    }

    const tenantId = assignmentLookup.tenantId;

    const trusted = await resolveTrustedActor({
      verifiedUserId: tokenResult.userId,
      repository: this.repository,
      tenantId,
      tournamentId,
      matchId,
    });
    if (!trusted.ok) {
      return trusted;
    }

    const payloadCheck = validateMatchCommandPayload(commandType, payload);
    if (!payloadCheck.ok) {
      return payloadCheck;
    }

    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });

    const requestHashPreview = buildCommandRequestHash({
      commandType,
      payload,
      clientMutationId,
    });
    const cachedCommand = await repoVal(this.repository.findIdempotency(matchStateId, idempotencyKey));
    if (cachedCommand?.responsePayload) {
      if (cachedCommand.requestHash && cachedCommand.requestHash !== requestHashPreview) {
        return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
      }
      return createPersistenceSuccess({ duplicate: true, ...cachedCommand.responsePayload });
    }

    const currentLive = await repoVal(this.repository.getLiveState(matchStateId));
    if (!currentLive) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }

    if (currentLive.status === MATCH_STATUS.LOCKED) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_LOCKED);
    }

    const currentState = deserializeMatchState(currentLive.statePayload);
    const rawEvents = await repoVal(this.repository.getEvents(matchStateId));
    const eventHistory = rawEvents
      .filter((e) => e.event_type !== MATCH_EVENT_TYPE.EVENT_REVERTED)
      .map((e) => ({
        eventId: e.id,
        eventType: e.command_type,
        sequence: e.event_sequence,
        expectedVersion: e.state_version_before,
        actorId: e.actor_id,
        payload: e.command_payload,
      }));

    const command = {
      eventId: clientMutationId || `cmd-${Date.now()}`,
      eventType: commandType,
      sequence: Number(expectedSequence ?? currentLive.lastEventSequence) + 1,
      expectedVersion: Number(expectedVersion ?? currentLive.stateVersion),
      actorId: trusted.actor.userId,
      clientMutationId,
      idempotencyKey,
      payload,
    };

    const initialState = await repoVal(this.repository.getInitialState(matchStateId));
    const engineResult = dispatchMatchCommand({
      state: currentState,
      command,
      history: eventHistory,
      initialState,
    });

    if (!engineResult.ok) {
      return mapEngineErrorToPersistence(engineResult, {
        currentVersion: currentLive.stateVersion,
        currentSequence: currentLive.lastEventSequence,
      });
    }

    const nextState = {
      ...engineResult.nextState,
      stateSchemaVersion: STATE_SCHEMA_VERSION,
    };

    const requestHash = buildCommandRequestHash({
      commandType,
      payload,
      clientMutationId,
    });

    const recheckCached = await repoVal(this.repository.findIdempotency(matchStateId, idempotencyKey));
    if (recheckCached?.responsePayload) {
      if (recheckCached.requestHash && recheckCached.requestHash !== requestHash) {
        return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
      }
      return createPersistenceSuccess({ duplicate: true, ...recheckCached.responsePayload });
    }

    return this.atomicCommit.commitMatchTransition({
      tenantId,
      tournamentId,
      matchId,
      actor: trusted.actor,
      assignment: trusted.assignment,
      expectedStateVersion: expectedVersion ?? currentLive.stateVersion,
      expectedEventSequence: expectedSequence ?? currentLive.lastEventSequence,
      clientMutationId,
      idempotencyKey,
      requestHash,
      commandType,
      commandPayload: payload,
      nextState,
      generatedEvents: engineResult.generatedEvents,
      stateBefore: currentState,
      stateBeforeHash: hashMatchStateCanonical(currentState),
      stateAfterHash: hashMatchStateCanonical(nextState),
    });
  }

  async processFinalize({
    accessToken,
    tournamentId,
    matchId,
    expectedVersion,
    idempotencyKey,
    overrideReason = null,
    isOverride = false,
    forceComplete = false,
    requestBody = {},
  }) {
    rejectClientIdentityFields(requestBody);

    const tokenResult = deriveUserIdFromVerifiedToken(accessToken);
    if (!tokenResult.ok) {
      return tokenResult;
    }

    const assignmentLookup = await repoVal(
      this.repository.findAssignmentByUserAndMatch({
        userId: tokenResult.userId,
        tournamentId,
        matchId,
      }),
    );
    if (!assignmentLookup) {
      return createPersistenceError(REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
    }

    const tenantId = assignmentLookup.tenantId;
    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    const finalizeKey = `finalize::${idempotencyKey}`;
    const requestHashPreview = buildCommandRequestHash({
      commandType: isOverride ? "OVERRIDE_RESULT" : "FINALIZE_MATCH",
      payload: { overrideReason, isOverride },
      clientMutationId: idempotencyKey,
    });
    const cachedFinalize = await repoVal(this.repository.findIdempotency(matchStateId, finalizeKey));
    if (cachedFinalize?.responsePayload) {
      if (cachedFinalize.requestHash && cachedFinalize.requestHash !== requestHashPreview) {
        return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
      }
      return createPersistenceSuccess({ duplicate: true, ...cachedFinalize.responsePayload });
    }

    const trusted = await resolveTrustedActor({
      verifiedUserId: tokenResult.userId,
      repository: this.repository,
      tenantId,
      tournamentId,
      matchId,
    });
    if (!trusted.ok) {
      return trusted;
    }

    const live = await repoVal(this.repository.getLiveState(matchStateId));
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }

    const state = deserializeMatchState(live.statePayload);
    const replayCheck = await this.verifySnapshotMatchesReplay(matchStateId);
    if (!replayCheck.ok) {
      return createPersistenceError(REFEREE_V5_ERROR.FINALIZE_FAILED, "Replay verification failed.");
    }

    const scoreA = state.teams.teamA.score;
    const scoreB = state.teams.teamB.score;
    const winnerTeamId =
      scoreA === scoreB
        ? null
        : scoreA > scoreB
          ? state.teams.teamA.teamId
          : state.teams.teamB.teamId;

    const revision = {
      tenantId,
      tournamentId,
      matchId,
      revision: 1,
      status: isOverride ? "OVERRIDDEN" : "CONFIRMED",
      teamAId: state.teams.teamA.teamId,
      teamBId: state.teams.teamB.teamId,
      officialScore: { teamA: scoreA, teamB: scoreB },
      winnerId: winnerTeamId,
      idempotencyKey,
      overrideReason,
      createdBy: trusted.actor.userId,
      createdAt: new Date().toISOString(),
      // Scoring-system agnostic format metadata (Rally/Side-Out).
      scoringFormat: state.scoringFormat ?? null,
      scoringSystem: state.scoringSystem ?? null,
      scoringVariant: state.scoringVariant ?? null,
      ruleSetId: state.ruleSetId ?? null,
      pointsToWin: state.pointsToWin ?? null,
      winBy: state.winBy ?? null,
    };

    const requestHash = buildCommandRequestHash({
      commandType: isOverride ? "OVERRIDE_RESULT" : "FINALIZE_MATCH",
      payload: { overrideReason, isOverride },
      clientMutationId: idempotencyKey,
    });

    const outboxEvents = [
      { eventType: OUTBOX_EVENT_TYPES[0], payload: { matchId, revision: 1 } },
      { eventType: OUTBOX_EVENT_TYPES[1], payload: { matchId } },
      { eventType: OUTBOX_EVENT_TYPES[2], payload: { matchId, type: "result_confirmed" } },
    ];

    return this.atomicCommit.commitMatchFinalization({
      tenantId,
      tournamentId,
      matchId,
      actor: trusted.actor,
      assignment: trusted.assignment,
      expectedStateVersion: expectedVersion ?? live.stateVersion,
      idempotencyKey,
      requestHash,
      revision,
      overrideReason,
      isOverride,
      forceComplete,
      outboxEvents,
    });
  }

  async verifySnapshotMatchesReplay(matchStateId) {
    const live = await repoVal(this.repository.getLiveState(matchStateId));
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }
    const initial = await repoVal(this.repository.getInitialState(matchStateId));
    if (!initial) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND, "Missing initial state for replay.");
    }
    const rawEvents = await repoVal(this.repository.getEvents(matchStateId));
    let state = initial;
    let history = [];
    for (const e of rawEvents) {
      const command = {
        eventId: e.id || String(e.event_sequence),
        eventType: e.command_type || e.event_type,
        sequence: e.event_sequence,
        expectedVersion: e.state_version_before,
        actorId: e.actor_id || "",
        payload: e.command_payload?._initialState ? {} : (e.command_payload || {}),
      };
      const result = dispatchMatchCommand({
        state,
        command,
        history,
        initialState: initial,
      });
      if (!result.ok) {
        return { ok: false, error: result.error || result.code };
      }
      state = result.nextState;
      history = result.eventHistory || history;
    }
    const snapshot = deserializeMatchState(live.statePayload);
    const snapshotHash = hashMatchStateCanonical(snapshot);
    const rebuiltHash = hashMatchStateCanonical(state);
    return { ok: snapshotHash === rebuiltHash, snapshot, rebuilt: state, snapshotHash, rebuiltHash };
  }
}

export { OUTBOX_EVENT_TYPES };
