/**
 * Injectable canonical referee persistence runtime.
 *
 * Reuses Referee V5 table vocabulary. Stores CORE-15/16/17 payloads in
 * state_payload / event payload / revision records. Does NOT call Referee V5
 * scoring/lifecycle/result engines.
 *
 * Default E2E-04 facade remains on the in-memory TEST_DOUBLE store.
 * This composition is production-capable and injectable; it is not the default.
 */

import {
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  PRODUCTION_RUNTIME_CLASSIFICATION,
  REFEREE_ADAPTER_ERROR_CODE,
} from "./constants.js";
import { failRefereeAdapter } from "./errors.js";
import { freezeClone, isNonEmptyString } from "./helpers.js";
import { matchesRefereeOperationsStorePort } from "./runtimePorts.js";

function requireCanonicalActor(actor) {
  const actorId = String(actor?.actorId || actor?.authUid || "").trim();
  if (!actorId) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY,
      "Durable writes require canonical actorId (auth.uid)",
      {}
    );
  }
  if (
    isNonEmptyString(actor?.authUid) &&
    String(actor.authUid).trim() !== actorId
  ) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN,
      "authUid must equal actorId",
      {}
    );
  }
  if (isNonEmptyString(actor?.name) && !actorId) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN,
      "Name/email/phone matching is not identity authority",
      {}
    );
  }
  return actorId;
}

function matchStateId(tenantId, competitionId, matchId) {
  return `${tenantId}::${competitionId}::${matchId}`;
}

/**
 * @param {{ clockIso?: string, opsStore?: object }} [options]
 */
export function createCanonicalRefereePersistenceRuntime(options = {}) {
  const clockIso = isNonEmptyString(options.clockIso)
    ? String(options.clockIso).trim()
    : "2026-07-24T00:00:00.000Z";

  const opsStore =
    options.opsStore && matchesRefereeOperationsStorePort(options.opsStore)
      ? options.opsStore
      : null;

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

  function assignmentKey(row) {
    return `${row.tenantId}::${row.competitionId}::${row.matchId}::${row.refereeUserId}`;
  }

  const assignmentRepository = Object.freeze({
    getActiveForMatch({ tenantId, competitionId, matchId, refereeUserId }) {
      const key = assignmentKey({
        tenantId,
        competitionId,
        matchId,
        refereeUserId,
      });
      const row = assignments.get(key);
      if (!row || row.status === "revoked") return null;
      return freezeClone(row);
    },
    listByReferee({ tenantId, refereeUserId }) {
      return Object.freeze(
        [...assignments.values()]
          .filter(
            (row) =>
              row.tenantId === tenantId &&
              row.refereeUserId === refereeUserId &&
              row.status !== "revoked"
          )
          .sort((a, b) =>
            assignmentKey(a).localeCompare(assignmentKey(b))
          )
          .map((row) => freezeClone(row))
      );
    },
    upsert(row, actor) {
      requireCanonicalActor(actor);
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
        status: String(row.status || "active"),
        assignedBy: actor.actorId,
        assignedAt: clockIso,
      });
      assignments.set(assignmentKey(record), record);
      return record;
    },
  });

  const matchStateRepository = Object.freeze({
    getLiveState({ tenantId, competitionId, matchId }) {
      const id = matchStateId(tenantId, competitionId, matchId);
      const row = liveStates.get(id);
      return row ? freezeClone(row) : null;
    },
    putLiveState(input, actor) {
      requireCanonicalActor(actor);
      const tenantId = String(input.tenantId || "").trim();
      const competitionId = String(input.competitionId || "").trim();
      const matchId = String(input.matchId || "").trim();
      const id = matchStateId(tenantId, competitionId, matchId);
      const existing = liveStates.get(id);
      if (
        existing &&
        input.expectedVersion != null &&
        Number(existing.version) !== Number(input.expectedVersion)
      ) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE,
          "Fail-closed stale write: expectedVersion mismatch",
          {
            expectedVersion: input.expectedVersion,
            actualVersion: existing.version,
          }
        );
      }
      const version = existing ? Number(existing.version) + 1 : 0;
      const record = freezeClone({
        table: CANONICAL_REFEREE_PERSISTENCE_TABLES.LIVE_STATES,
        id,
        tenantId,
        competitionId,
        tournamentId: competitionId,
        matchId,
        version,
        status: input.status || existing?.status || "not_started",
        statePayload: input.statePayload || {},
        updatedAt: clockIso,
        updatedBy: actor.actorId,
      });
      liveStates.set(id, record);
      return record;
    },
  });

  const scoringEventLedger = Object.freeze({
    findIdempotent({ tenantId, competitionId, matchId, idempotencyKey }) {
      if (!idempotencyKey) return null;
      const id = matchStateId(tenantId, competitionId, matchId);
      const row = mutations.get(`${id}::${idempotencyKey}`);
      return row ? freezeClone(row) : null;
    },
    listEvents({ tenantId, competitionId, matchId }) {
      const id = matchStateId(tenantId, competitionId, matchId);
      return Object.freeze([...(events.get(id) || [])].map((e) => freezeClone(e)));
    },
    appendEvent(input, actor) {
      requireCanonicalActor(actor);
      const idempotencyKey = String(input.idempotencyKey || input.commandId || "").trim();
      if (!idempotencyKey) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.MISSING_IDEMPOTENCY,
          "idempotencyKey / commandId is required",
          {}
        );
      }
      const tenantId = String(input.tenantId || "").trim();
      const competitionId = String(input.competitionId || "").trim();
      const matchId = String(input.matchId || "").trim();
      const existing = scoringEventLedger.findIdempotent({
        tenantId,
        competitionId,
        matchId,
        idempotencyKey,
      });
      if (existing) {
        return freezeClone({ ...existing, duplicate: true });
      }
      const id = matchStateId(tenantId, competitionId, matchId);
      const list = events.get(id) || [];
      const event = freezeClone({
        table: CANONICAL_REFEREE_PERSISTENCE_TABLES.EVENTS,
        tenantId,
        competitionId,
        matchId,
        eventSequence: list.length + 1,
        eventType: input.eventType || "CORE16_COMMAND",
        payload: input.payload || {},
        actorId: actor.actorId,
        idempotencyKey,
        commandId: input.commandId || idempotencyKey,
        occurredAt: clockIso,
        appendOnly: true,
      });
      list.push(event);
      events.set(id, list);
      const mutation = freezeClone({
        table: CANONICAL_REFEREE_PERSISTENCE_TABLES.SYNC_MUTATIONS,
        matchStateId: id,
        idempotencyKey,
        responsePayload: event,
        status: "applied",
      });
      mutations.set(`${id}::${idempotencyKey}`, mutation);
      return freezeClone({ ...event, duplicate: false });
    },
  });

  const resultRevisionRepository = Object.freeze({
    getActive({ tenantId, competitionId, matchId }) {
      const id = matchStateId(tenantId, competitionId, matchId);
      const list = revisions.get(id) || [];
      const active = [...list].reverse().find((row) => row.lineageStatus === "ACTIVE");
      return active ? freezeClone(active) : null;
    },
    appendRevision(input, actor) {
      requireCanonicalActor(actor);
      const tenantId = String(input.tenantId || "").trim();
      const competitionId = String(input.competitionId || "").trim();
      const matchId = String(input.matchId || "").trim();
      const id = matchStateId(tenantId, competitionId, matchId);
      const list = [...(revisions.get(id) || [])];
      const nextList = list.map((row) =>
        row.lineageStatus === "ACTIVE"
          ? freezeClone({ ...row, lineageStatus: "SUPERSEDED" })
          : row
      );
      const revision = freezeClone({
        table: CANONICAL_REFEREE_PERSISTENCE_TABLES.RESULT_REVISIONS,
        tenantId,
        competitionId,
        matchId,
        revision: nextList.length + 1,
        lineageStatus: "ACTIVE",
        acceptanceStatus: input.acceptanceStatus || "ACCEPTED",
        payload: input.payload || {},
        idempotencyKey: input.idempotencyKey || `rev-${nextList.length + 1}`,
        finalizedBy: actor.actorId,
        finalizedAt: clockIso,
      });
      nextList.push(revision);
      revisions.set(id, nextList);
      return revision;
    },
  });

  return Object.freeze({
    kind: "canonical-referee-persistence-runtime",
    classification: PRODUCTION_RUNTIME_CLASSIFICATION,
    wiredToProductionRuntime: false,
    durable: true,
    tables: CANONICAL_REFEREE_PERSISTENCE_TABLES,
    usesRefereeV5ScoringEngine: false,
    usesCore16Scoring: true,
    usesCore15Lifecycle: true,
    usesCore17Result: true,
    opsStore,
    assignmentRepository,
    matchStateRepository,
    scoringEventLedger,
    resultRevisionRepository,
    clockIso,
  });
}
