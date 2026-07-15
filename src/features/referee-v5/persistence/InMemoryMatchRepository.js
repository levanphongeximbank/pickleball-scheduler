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
    /** Test-only fault injection for atomic rollback coverage (never Production). */
    this.testFault = null;
  }

  setTestFault(fault) {
    this.testFault = fault;
  }

  clearTestFault() {
    this.testFault = null;
  }

  _checkpointMatch(matchStateId) {
    const live = this.liveStates.get(matchStateId);
    const events = this.events.get(matchStateId) || [];
    const idempotencyEntries = [...this.idempotency.entries()].filter(([key]) =>
      key.startsWith(`${matchStateId}::`)
    );
    return {
      live: live
        ? {
            ...live,
            statePayload: live.statePayload,
            initialStatePayload: live.initialStatePayload,
          }
        : null,
      events: events.map((event) => ({ ...event })),
      idempotencyEntries,
      results: [...this.results.entries()],
      outbox: this.outbox.map((item) => ({ ...item })),
    };
  }

  _restoreCheckpoint(matchStateId, checkpoint) {
    if (!checkpoint.live) {
      this.liveStates.delete(matchStateId);
    } else {
      this.liveStates.set(matchStateId, { ...checkpoint.live });
    }
    this.events.set(matchStateId, checkpoint.events.map((event) => ({ ...event })));
    for (const key of [...this.idempotency.keys()]) {
      if (key.startsWith(`${matchStateId}::`)) {
        this.idempotency.delete(key);
      }
    }
    for (const [key, value] of checkpoint.idempotencyEntries) {
      this.idempotency.set(key, { ...value });
    }
    this.results.clear();
    for (const [key, value] of checkpoint.results) {
      this.results.set(key, { ...value });
    }
    this.outbox = checkpoint.outbox.map((item) => ({ ...item }));
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

    const checkpoint = this._checkpointMatch(matchStateId);

    try {
      events.push({ ...eventRecord });
      this.events.set(matchStateId, events);

      if (this.testFault === "after_event_insert") {
        throw new Error("TEST_FAULT_AFTER_EVENT_INSERT");
      }

      live.stateVersion = nextState.version;
      live.lastEventSequence = nextState.lastEventSequence;
      live.status = nextState.status;
      live.statePayload = serializeMatchState(nextState);
      live.stateHash = hashMatchState(nextState);
      live.updatedAt = new Date().toISOString();

      if (this.testFault === "after_snapshot_update") {
        throw new Error("TEST_FAULT_AFTER_SNAPSHOT_UPDATE");
      }

      if (this.testFault === "before_idempotency_completion") {
        throw new Error("TEST_FAULT_BEFORE_IDEMPOTENCY");
      }

      if (idempotencyRecord) {
        this.saveIdempotency(idempotencyRecord);
      }

      return { ok: true, live, events };
    } catch (error) {
      this._restoreCheckpoint(matchStateId, checkpoint);
      return createPersistenceError(
        REFEREE_V5_ERROR.ATOMIC_COMMIT_ABORTED,
        error.message
      );
    }
  }

  commitFinalizationMutation({
    matchStateId,
    revision,
    actorId,
    outboxEvents = [],
    idempotencyRecord,
  }) {
    const checkpoint = this._checkpointMatch(matchStateId);

    try {
      const saved = this.saveResultRevision(revision);
      if (!saved.ok && !saved.duplicate) {
        throw new Error("RESULT_REVISION_FAILED");
      }

      if (this.testFault === "after_result_revision") {
        throw new Error("TEST_FAULT_AFTER_RESULT_REVISION");
      }

      const locked = this.lockLiveState(matchStateId, actorId);
      if (!locked.ok) {
        throw new Error(locked.error || "LOCK_FAILED");
      }

      if (this.testFault === "after_state_lock") {
        throw new Error("TEST_FAULT_AFTER_STATE_LOCK");
      }

      for (const outbox of outboxEvents) {
        this.appendOutbox(outbox);
      }

      if (this.testFault === "after_outbox") {
        throw new Error("TEST_FAULT_AFTER_OUTBOX");
      }

      if (idempotencyRecord) {
        this.saveIdempotency(idempotencyRecord);
      }

      return { ok: true, revision: saved.revision || revision };
    } catch (error) {
      this._restoreCheckpoint(matchStateId, checkpoint);
      return createPersistenceError(
        REFEREE_V5_ERROR.ATOMIC_COMMIT_ABORTED,
        error.message
      );
    }
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
