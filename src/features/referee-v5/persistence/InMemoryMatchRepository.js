import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../constants/eventTypes.js";
import { buildMatchStateId, deserializeMatchState, hashMatchState, serializeMatchState } from "./matchStateSerializer.js";
import { REFEREE_V5_ERROR, createPersistenceError } from "./errors.js";

/**
 * In-memory repository simulating Postgres row locks + append-only events.
 * Used for integration tests before SQL apply.
 */
export class InMemoryMatchRepository {
  constructor() {
    this.liveStates = new Map();
    this.events = new Map();
    this.idempotency = new Map();
    this.assignments = new Map();
    this.results = new Map();
    this.locks = new Set();
    this.auditLog = [];
    this.outbox = [];
    this.appendOnlyEnforced = true;
  }

  findAssignmentByUserAndMatch({ userId, tournamentId, matchId }) {
    for (const assignment of this.assignments.values()) {
      if (
        String(assignment.userId) === String(userId) &&
        assignment.tournamentId === tournamentId &&
        assignment.matchId === matchId
      ) {
        return assignment;
      }
    }
    return null;
  }

  upsertAssignment(assignment) {
    const key = `${assignment.tenantId}::${assignment.tournamentId}::${assignment.matchId}::${assignment.userId}`;
    this.assignments.set(key, { ...assignment });
    return assignment;
  }

  getAssignment({ tenantId, tournamentId, matchId, userId }) {
    const key = `${tenantId}::${tournamentId}::${matchId}::${userId}`;
    return this.assignments.get(key) || null;
  }

  initLiveState({ tenantId, tournamentId, matchId, initialState, config = {} }) {
    const id = buildMatchStateId({ tenantId, tournamentId, matchId });
    const record = {
      matchId: id,
      tenantId,
      tournamentId,
      matchIdRaw: matchId,
      stateVersion: initialState.version ?? 0,
      lastEventSequence: initialState.lastEventSequence ?? 0,
      status: initialState.status,
      statePayload: serializeMatchState(initialState),
      initialStatePayload: serializeMatchState(initialState),
      teamAId: initialState.teams?.teamA?.teamId || config.teamAId || "",
      teamBId: initialState.teams?.teamB?.teamId || config.teamBId || "",
      config,
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date().toISOString(),
    };
    this.liveStates.set(id, record);
    this.events.set(id, []);
    return record;
  }

  findConflictingLiveState({ tenantId, tournamentId, matchId, matchStateId }) {
    for (const row of this.liveStates.values()) {
      if (String(row.matchIdRaw) === String(matchId) && row.matchId !== matchStateId) {
        return row;
      }
      if (
        row.matchId === matchStateId &&
        (String(row.tenantId) !== String(tenantId) ||
          String(row.tournamentId) !== String(tournamentId))
      ) {
        return row;
      }
    }
    return null;
  }

  async initializeExecutionState({
    tenantId,
    tournamentId,
    matchId,
    initialState,
    teamAId,
    teamBId,
    idempotencyKey,
    requestHash,
  }) {
    const matchStateId = buildMatchStateId({ tenantId, tournamentId, matchId });
    return this.withRowLock(matchStateId, async () => {
      const cached = this.findIdempotency(matchStateId, idempotencyKey);
      if (cached) {
        if (cached.requestHash && cached.requestHash !== requestHash) {
          return createPersistenceError(REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
        }
        if (cached.responsePayload) {
          return { ok: true, duplicate: true, alreadyInitialized: true, reset: false, initialized: false, ...cached.responsePayload };
        }
      }

      const conflict = this.findConflictingLiveState({
        tenantId,
        tournamentId,
        matchId,
        matchStateId,
      });
      if (conflict) {
        return createPersistenceError(
          REFEREE_V5_ERROR.MATCH_STATE_CONFLICT,
          "Existing live state conflicts with requested identity."
        );
      }

      const existing = this.getLiveState(matchStateId);
      if (existing) {
        if (
          String(existing.tenantId) !== String(tenantId) ||
          String(existing.tournamentId) !== String(tournamentId) ||
          String(existing.matchIdRaw) !== String(matchId)
        ) {
          return createPersistenceError(
            REFEREE_V5_ERROR.MATCH_STATE_CONFLICT,
            "Existing live state conflicts with requested identity."
          );
        }
        const status = String(existing.status || "");
        if (status === MATCH_STATUS.LOCKED) {
          return createPersistenceError(REFEREE_V5_ERROR.MATCH_LOCKED);
        }
        if (status === MATCH_STATUS.COMPLETED || status === "cancelled" || status === "disputed") {
          return createPersistenceError(REFEREE_V5_ERROR.TERMINAL_STATE);
        }
        const version = Number(existing.stateVersion ?? 0);
        const sequence = Number(existing.lastEventSequence ?? 0);
        const scoringActive =
          status === MATCH_STATUS.IN_PROGRESS ||
          status === MATCH_STATUS.PAUSED ||
          status === "SCORING_ACTIVE" ||
          status === "scoring_active" ||
          status === "game_break";
        if (scoringActive || version > 0 || sequence > 0) {
          return createPersistenceError(REFEREE_V5_ERROR.MATCH_ALREADY_ACTIVE);
        }
        const state = deserializeMatchState(existing.statePayload);
        const responsePayload = {
          capabilityId: "SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION",
          matchStateId,
          tenantId,
          tournamentId,
          matchId,
          status: existing.status,
          stateVersion: existing.stateVersion,
          lastEventSequence: existing.lastEventSequence,
          state,
          stateHash: hashMatchState(state),
        };
        this.saveIdempotency({
          matchId: matchStateId,
          idempotencyKey,
          requestHash,
          responsePayload,
          status: "applied",
        });
        return {
          ok: true,
          initialized: false,
          alreadyInitialized: true,
          duplicate: false,
          reset: false,
          ...responsePayload,
        };
      }

      const record = this.initLiveState({
        tenantId,
        tournamentId,
        matchId,
        initialState,
        config: { teamAId, teamBId },
      });
      const state = deserializeMatchState(record.statePayload);
      const responsePayload = {
        capabilityId: "SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION",
        matchStateId,
        tenantId,
        tournamentId,
        matchId,
        status: record.status,
        stateVersion: record.stateVersion,
        lastEventSequence: record.lastEventSequence,
        state,
        stateHash: hashMatchState(state),
      };
      this.saveIdempotency({
        matchId: matchStateId,
        idempotencyKey,
        requestHash,
        responsePayload,
        status: "applied",
      });
      return {
        ok: true,
        initialized: true,
        alreadyInitialized: false,
        duplicate: false,
        reset: false,
        ...responsePayload,
      };
    });
  }

  getLiveState(matchStateId) {
    return this.liveStates.get(matchStateId) || null;
  }

  async atomicTransaction(matchStateId, fn) {
    return this.withRowLock(matchStateId, fn);
  }

  updateEventRecord() {
    if (this.appendOnlyEnforced) {
      return createPersistenceError(REFEREE_V5_ERROR.APPEND_ONLY_VIOLATION);
    }
    return { ok: false };
  }

  deleteEventRecord() {
    if (this.appendOnlyEnforced) {
      return createPersistenceError(REFEREE_V5_ERROR.APPEND_ONLY_VIOLATION);
    }
    return { ok: false };
  }

  appendOutbox(record) {
    const key = `${record.matchId}::${record.idempotencyKey}`;
    if (this.outbox.some((item) => `${item.matchId}::${item.idempotencyKey}` === key)) {
      return { ok: true, duplicate: true };
    }
    this.outbox.push({ ...record, createdAt: new Date().toISOString() });
    return { ok: true, duplicate: false };
  }

  async withRowLock(matchStateId, fn) {
    while (this.locks.has(matchStateId)) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    this.locks.add(matchStateId);
    try {
      return await fn();
    } finally {
      this.locks.delete(matchStateId);
    }
  }

  findIdempotency(matchStateId, idempotencyKey) {
    if (!idempotencyKey) {
      return null;
    }
    return this.idempotency.get(`${matchStateId}::${idempotencyKey}`) || null;
  }

  saveIdempotency(record) {
    const key = `${record.matchId}::${record.idempotencyKey}`;
    this.idempotency.set(key, { ...record });
  }

  appendEventAndSnapshot({
    matchStateId,
    eventRecord,
    nextState,
    idempotencyRecord,
  }) {
    const live = this.liveStates.get(matchStateId);
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }

    const events = this.events.get(matchStateId) || [];
    const duplicateSeq = events.some((e) => e.event_sequence === eventRecord.event_sequence);
    if (duplicateSeq) {
      return createPersistenceError(REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT);
    }

    events.push({ ...eventRecord });
    this.events.set(matchStateId, events);

    live.stateVersion = nextState.version;
    live.lastEventSequence = nextState.lastEventSequence;
    live.status = nextState.status;
    live.statePayload = serializeMatchState(nextState);
    live.stateHash = hashMatchState(nextState);
    live.updatedAt = new Date().toISOString();

    if (idempotencyRecord) {
      this.saveIdempotency(idempotencyRecord);
    }

    return { ok: true, live, events };
  }

  getEvents(matchStateId) {
    return [...(this.events.get(matchStateId) || [])];
  }

  getInitialState(matchStateId) {
    const live = this.liveStates.get(matchStateId);
    if (!live) {
      return null;
    }
    return deserializeMatchState(live.initialStatePayload);
  }

  lockLiveState(matchStateId, actorId) {
    const live = this.liveStates.get(matchStateId);
    if (!live) {
      return createPersistenceError(REFEREE_V5_ERROR.MATCH_NOT_FOUND);
    }
    live.status = MATCH_STATUS.LOCKED;
    live.lockedAt = new Date().toISOString();
    live.lockedBy = actorId;
    const state = deserializeMatchState(live.statePayload);
    state.status = MATCH_STATUS.LOCKED;
    live.statePayload = serializeMatchState(state);
    return { ok: true, live };
  }

  saveResultRevision(revision) {
    const key = `${revision.tenantId}::${revision.tournamentId}::${revision.matchId}::${revision.idempotencyKey}`;
    if (this.results.has(key)) {
      return { ok: true, duplicate: true, revision: this.results.get(key) };
    }
    this.results.set(key, { ...revision });
    return { ok: true, duplicate: false, revision };
  }

  appendAudit(entry) {
    this.auditLog.push({ ...entry });
  }
}

export function buildCommandEventRecord({
  matchStateId,
  tenantId,
  tournamentId,
  matchId,
  command,
  beforeVersion,
  afterVersion,
  beforeHash,
  afterHash,
  generatedEvents,
  actorRole,
}) {
  return {
    id: `evt-${command.eventId || command.sequence}`,
    match_state_id: matchStateId,
    tenant_id: tenantId,
    tournament_id: tournamentId,
    match_id: matchId,
    game_number: 1,
    event_sequence: command.sequence,
    event_type: command.eventType,
    command_type: command.eventType,
    command_payload: command.payload || {},
    state_version_before: beforeVersion,
    state_version_after: afterVersion,
    state_before_hash: beforeHash,
    state_after_hash: afterHash,
    generated_events: generatedEvents || [],
    actor_id: command.actorId,
    actor_role: actorRole,
    client_mutation_id: command.clientMutationId || null,
    idempotency_key: command.idempotencyKey || null,
    reverts_event_id: command.eventType === MATCH_EVENT_TYPE.EVENT_REVERTED ? command.payload?.revertedEventId : null,
    created_at: new Date().toISOString(),
  };
}
