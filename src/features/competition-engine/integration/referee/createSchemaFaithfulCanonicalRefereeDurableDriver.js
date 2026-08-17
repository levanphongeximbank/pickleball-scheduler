/**
 * Schema-faithful durable driver mirroring live Staging V5 tables/RPC semantics.
 *
 * TEST_DOUBLE_ONLY: not a live database. Used to certify production composition
 * locally. Does not call Referee V5 scoring/lifecycle/finalize engines.
 * Does not call Team Tournament bridge/assert RPCs.
 */

import {
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  IN_MEMORY_RUNTIME_CLASSIFICATION,
  LIVE_RESULT_STATUS,
  REFEREE_ADAPTER_ERROR_CODE,
  SCHEMA_FAITHFUL_DRIVER_KIND,
} from "./constants.js";
import { failRefereeAdapter } from "./errors.js";
import { freezeClone, hashCanonical, isNonEmptyString, matchStateId } from "./helpers.js";
import { requireCanonicalRefereeActor } from "./requireCanonicalRefereeActor.js";

function assignmentKey(row) {
  return `${row.tenantId}::${row.competitionId}::${row.matchId}::${row.refereeUserId}`;
}

function isActiveAssignment(row, nowIso) {
  if (!row || row.status === "revoked" || row.status === "expired") return false;
  if (row.revokedAt) return false;
  if (row.expiresAt && String(row.expiresAt) <= String(nowIso)) return false;
  return row.status === "active";
}

/**
 * @param {{ clockIso?: string }} [options]
 */
export function createSchemaFaithfulCanonicalRefereeDurableDriver(options = {}) {
  const clockIso = isNonEmptyString(options.clockIso)
    ? String(options.clockIso).trim()
    : "2026-07-24T00:00:00.000Z";

  /** @type {Map<string, object>} */
  const assignments = new Map();
  /** @type {Map<string, object>} */
  const liveStates = new Map();
  /** @type {Map<string, object[]>} */
  const events = new Map();
  /** @type {Map<string, object>} */
  const mutations = new Map();
  /** @type {Map<string, object[]>} */
  const revisions = new Map();

  function mutationKey(id, idempotencyKey) {
    return `${id}::${idempotencyKey}`;
  }

  function requireAssignment(scope, actorId) {
    const row = assignments.get(
      assignmentKey({
        tenantId: scope.tenantId,
        competitionId: scope.competitionId,
        matchId: scope.matchId,
        refereeUserId: actorId,
      })
    );
    if (!isActiveAssignment(row, clockIso)) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED,
        "Referee is not assigned to this match",
        { matchId: scope.matchId, actorId }
      );
    }
    if (row.tenantId !== scope.tenantId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
        "Cross-tenant referee write rejected",
        { tenantId: scope.tenantId, assignmentTenantId: row.tenantId }
      );
    }
    return row;
  }

  function getLive(scope) {
    return liveStates.get(
      matchStateId(scope.tenantId, scope.competitionId, scope.matchId)
    ) || null;
  }

  function listEventsFor(scope) {
    const id = matchStateId(scope.tenantId, scope.competitionId, scope.matchId);
    return [...(events.get(id) || [])];
  }

  function findMutation(scope, idempotencyKey) {
    if (!idempotencyKey) return null;
    const id = matchStateId(scope.tenantId, scope.competitionId, scope.matchId);
    return mutations.get(mutationKey(id, idempotencyKey)) || null;
  }

  function commitTransition(input, actor) {
    const actorId = requireCanonicalRefereeActor(actor);
    const tenantId = String(input.tenantId || "").trim();
    const competitionId = String(input.competitionId || input.tournamentId || "").trim();
    const matchId = String(input.matchId || "").trim();
    const idempotencyKey = String(input.idempotencyKey || input.commandId || "").trim();
    if (!idempotencyKey) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MISSING_IDEMPOTENCY,
        "idempotencyKey / commandId is required",
        {}
      );
    }
    const scope = { tenantId, competitionId, matchId };
    requireAssignment(scope, actorId);

    const requestHash =
      input.requestHash ||
      hashCanonical({
        commandType: input.commandType || input.eventType || "CORE_COMMAND",
        payload: input.payload || input.commandPayload || {},
        nextState: input.nextState || input.statePayload || {},
      });

    const existingMutation = findMutation(scope, idempotencyKey);
    if (existingMutation) {
      if (
        existingMutation.requestHash &&
        existingMutation.requestHash !== requestHash
      ) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.IDEMPOTENCY_CONFLICT,
          "Same idempotencyKey with a conflicting request is fail-closed",
          { idempotencyKey }
        );
      }
      return freezeClone({
        ok: true,
        duplicate: true,
        ...existingMutation.responsePayload,
      });
    }

    const id = matchStateId(tenantId, competitionId, matchId);
    const live = liveStates.get(id);
    if (!live) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
        "match_live_states row is required before commit",
        { matchId }
      );
    }
    const currentVersion = Number(live.stateVersion ?? live.version ?? 0);
    if (
      input.expectedVersion != null &&
      Number(input.expectedVersion) !== currentVersion
    ) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE,
        "Fail-closed stale write: expectedVersion mismatch",
        { expectedVersion: input.expectedVersion, actualVersion: currentVersion }
      );
    }

    const nextVersion = currentVersion + 1;
    const nextSequence = Number(live.lastEventSequence || 0) + 1;
    const eventList = [...(events.get(id) || [])];
    const event = freezeClone({
      table: CANONICAL_REFEREE_PERSISTENCE_TABLES.EVENTS,
      id: `evt-${id}-${nextSequence}`,
      tenantId,
      competitionId,
      tournamentId: competitionId,
      matchId,
      matchStateId: id,
      eventSequence: nextSequence,
      eventType: input.eventType || input.commandType || "CORE_COMMAND",
      payload: input.payload || input.commandPayload || {},
      stateVersionBefore: currentVersion,
      stateVersionAfter: nextVersion,
      actorId,
      idempotencyKey,
      commandId: input.commandId || idempotencyKey,
      requestHash,
      occurredAt: clockIso,
      appendOnly: true,
    });
    eventList.push(event);

    const nextState = freezeClone({
      ...(input.nextState || live.statePayload || {}),
      stateSchemaVersion: 1,
      matchId,
      version: nextVersion,
      lastEventSequence: nextSequence,
      status: input.status || input.nextState?.status || live.status,
    });

    const nextLive = freezeClone({
      ...live,
      version: nextVersion,
      stateVersion: nextVersion,
      lastEventSequence: nextSequence,
      status: nextState.status,
      statePayload: nextState,
      updatedAt: clockIso,
      updatedBy: actorId,
    });

    const responsePayload = freezeClone({
      ok: true,
      event,
      live: nextLive,
      stateVersion: nextVersion,
      lastEventSequence: nextSequence,
    });

    events.set(id, eventList);
    liveStates.set(id, nextLive);
    mutations.set(
      mutationKey(id, idempotencyKey),
      freezeClone({
        table: CANONICAL_REFEREE_PERSISTENCE_TABLES.SYNC_MUTATIONS,
        tenantId,
        matchStateId: id,
        matchId,
        idempotencyKey,
        clientMutationId: input.commandId || idempotencyKey,
        requestHash,
        requestPayload: event.payload,
        responsePayload,
        status: "applied",
        resultingEventSequence: nextSequence,
        resultingStateVersion: nextVersion,
      })
    );

    return freezeClone({
      ...responsePayload,
      duplicate: false,
      commitSubphases: Object.freeze({
        COMMIT_PREPARE_MS: 0,
        COMMIT_RPC_MS: 0,
        COMMIT_EVENT_WRITE_MS: 0,
        COMMIT_LIVE_STATE_MS: 0,
        COMMIT_RESULT_REVISION_MS: 0,
        COMMIT_ASSIGNMENT_UPSERT_MS: 0,
        COMMIT_SYNC_MUTATION_MS: 0,
        COMMIT_POST_READ_MS: 0,
        COMMIT_ATOMIC_RPC: "schema-faithful-in-memory",
        NOTE: "local schema-faithful driver; no Supabase network",
      }),
    });
  }

  function ensureLiveState(input, actor) {
    const actorId = requireCanonicalRefereeActor(actor);
    const tenantId = String(input.tenantId || "").trim();
    const competitionId = String(input.competitionId || input.tournamentId || "").trim();
    const matchId = String(input.matchId || "").trim();
    const id = matchStateId(tenantId, competitionId, matchId);
    const existing = liveStates.get(id);
    if (existing) return freezeClone(existing);
    const record = freezeClone({
      table: CANONICAL_REFEREE_PERSISTENCE_TABLES.LIVE_STATES,
      id,
      tenantId,
      competitionId,
      tournamentId: competitionId,
      matchId,
      version: 0,
      stateVersion: 0,
      lastEventSequence: 0,
      status: input.status || "not_started",
      teamAId: input.teamAId || "SIDE_A",
      teamBId: input.teamBId || "SIDE_B",
      statePayload: {
        stateSchemaVersion: 1,
        matchId,
        version: 0,
        lastEventSequence: 0,
        status: input.status || "not_started",
        canonical: input.canonical || {},
      },
      createdAt: clockIso,
      updatedAt: clockIso,
      updatedBy: actorId,
    });
    liveStates.set(id, record);
    events.set(id, []);
    return freezeClone(record);
  }

  function appendRevision(input, actor) {
    const actorId = requireCanonicalRefereeActor(actor);
    const tenantId = String(input.tenantId || "").trim();
    const competitionId = String(input.competitionId || "").trim();
    const matchId = String(input.matchId || "").trim();
    const scope = { tenantId, competitionId, matchId };
    requireAssignment(scope, actorId);
    const acceptanceStatus = String(input.acceptanceStatus || "").trim();
    if (acceptanceStatus && acceptanceStatus !== "ACCEPTED") {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.UNOFFICIAL_RESULT_FORBIDDEN,
        "Unaccepted results cannot persist as official revisions",
        { acceptanceStatus }
      );
    }
    const id = matchStateId(tenantId, competitionId, matchId);
    const list = [...(revisions.get(id) || [])];
    const previous = [...list].reverse().find((row) => row.lineageStatus === "ACTIVE");
    const nextRevision = list.length + 1;
    const idempotencyKey =
      String(input.idempotencyKey || "").trim() || `rev-${id}-${nextRevision}`;
    const existingByKey = list.find((row) => row.idempotencyKey === idempotencyKey);
    if (existingByKey) {
      return freezeClone({ ...existingByKey, duplicate: true });
    }
    const nextList = list.map((row) =>
      row.lineageStatus === "ACTIVE"
        ? freezeClone({
            ...row,
            lineageStatus: "SUPERSEDED",
            liveStatus:
              row.liveStatus === LIVE_RESULT_STATUS.CONFIRMED
                ? LIVE_RESULT_STATUS.CONFIRMED
                : row.liveStatus,
          })
        : row
    );
    const revision = freezeClone({
      table: CANONICAL_REFEREE_PERSISTENCE_TABLES.RESULT_REVISIONS,
      tenantId,
      competitionId,
      tournamentId: competitionId,
      matchId,
      revision: nextRevision,
      lineageStatus: "ACTIVE",
      liveStatus:
        previous != null
          ? LIVE_RESULT_STATUS.OVERRIDDEN
          : LIVE_RESULT_STATUS.CONFIRMED,
      acceptanceStatus: "ACCEPTED",
      payload: input.payload || {},
      idempotencyKey,
      supersedesRevision: previous ? previous.revision : null,
      finalizedBy: actorId,
      finalizedAt: clockIso,
      historicalPayloadImmutable: true,
    });
    nextList.push(revision);
    revisions.set(id, nextList);
    return freezeClone({ ...revision, duplicate: false });
  }

  return Object.freeze({
    kind: SCHEMA_FAITHFUL_DRIVER_KIND,
    classification: IN_MEMORY_RUNTIME_CLASSIFICATION,
    durable: true,
    mirrorsLiveSchema: true,
    usesLiveRpc: false,
    usesRefereeV5ScoringEngine: false,
    usesTeamBridge: false,
    tables: CANONICAL_REFEREE_PERSISTENCE_TABLES,
    clockIso,
    ensureLiveState,
    commitTransition,
    appendRevision,
    getLiveState(scope) {
      const row = getLive(scope);
      return row ? freezeClone(row) : null;
    },
    listLiveStates({ tenantId, competitionId }) {
      return Object.freeze(
        [...liveStates.values()]
          .filter(
            (row) =>
              row.tenantId === tenantId && row.competitionId === competitionId
          )
          .map((row) => freezeClone(row))
      );
    },
    getAssignment(scope) {
      const row = assignments.get(assignmentKey(scope));
      return row && isActiveAssignment(row, clockIso) ? freezeClone(row) : null;
    },
    listByReferee({ tenantId, refereeUserId }) {
      return Object.freeze(
        [...assignments.values()]
          .filter(
            (row) =>
              row.tenantId === tenantId &&
              row.refereeUserId === refereeUserId &&
              isActiveAssignment(row, clockIso)
          )
          .map((row) => freezeClone(row))
      );
    },
    listByCompetition({ tenantId, competitionId }) {
      return Object.freeze(
        [...assignments.values()]
          .filter(
            (row) =>
              row.tenantId === tenantId && row.competitionId === competitionId
          )
          .map((row) => freezeClone(row))
      );
    },
    upsertAssignment(row, actor) {
      const actorId = requireCanonicalRefereeActor(actor);
      const tenantId = String(row.tenantId || "").trim();
      const competitionId = String(row.competitionId || row.tournamentId || "").trim();
      const matchId = String(row.matchId || "").trim();
      const refereeUserId = String(row.refereeUserId || row.refereeId || "").trim();
      if (!tenantId || !competitionId || !matchId || !refereeUserId) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          "Assignment requires tenant, competition, match, refereeUserId",
          {}
        );
      }
      const record = freezeClone({
        table: CANONICAL_REFEREE_PERSISTENCE_TABLES.ASSIGNMENTS,
        tenantId,
        competitionId,
        tournamentId: competitionId,
        matchId,
        refereeUserId,
        role: row.role || "REFEREE",
        status: String(row.status || "active"),
        opsStatus: row.opsStatus || row.assignmentOpsStatus || "ASSIGNED",
        assignedBy: actorId,
        assignedAt: clockIso,
        version: Number(row.version || 1),
      });
      assignments.set(assignmentKey(record), record);
      return record;
    },
    listEvents: listEventsFor,
    findIdempotent(scope) {
      const row = findMutation(scope, scope.idempotencyKey);
      return row ? freezeClone(row) : null;
    },
    tryUpdateEvent() {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.APPEND_ONLY_VIOLATION,
        "match_events is append-only",
        {}
      );
    },
    tryDeleteEvent() {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.APPEND_ONLY_VIOLATION,
        "match_events is append-only",
        {}
      );
    },
    getActiveRevision(scope) {
      const id = matchStateId(scope.tenantId, scope.competitionId, scope.matchId);
      const list = revisions.get(id) || [];
      const active = [...list].reverse().find((row) => row.lineageStatus === "ACTIVE");
      return active ? freezeClone(active) : null;
    },
    listRevisions(scope) {
      const id = matchStateId(scope.tenantId, scope.competitionId, scope.matchId);
      return Object.freeze([...(revisions.get(id) || [])].map((row) => freezeClone(row)));
    },
  });
}
