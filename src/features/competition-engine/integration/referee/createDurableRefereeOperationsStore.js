/**
 * E2E-04 ops store backed by canonical durable tables.
 * Reconstructs F5/fresh-tab state from durable snapshots only.
 */

import {
  REFEREE_ASSIGNMENT_OPS_STATUS,
} from "../../operations/referee/constants.js";
import { clonePlain, deepFreeze, isNonEmptyString } from "../../operations/fingerprint.js";
import { hashCanonical, matchStateId } from "./helpers.js";
import { mapCore15ToLiveStatus } from "./mapCore15ToLiveStatus.js";
import { requireCanonicalRefereeActor } from "./requireCanonicalRefereeActor.js";

function emptyRecord(tenantId, competitionId) {
  return {
    tenantId: String(tenantId || "").trim() || null,
    competitionId: String(competitionId || "").trim() || null,
    venueId: null,
    assignments: [],
    matches: {},
    scoreSessions: {},
    validationByMatch: {},
    revision: 0,
  };
}

function opsStatusFromAssignment(row) {
  if (row.status === "revoked") return REFEREE_ASSIGNMENT_OPS_STATUS.RELEASED;
  return String(row.opsStatus || REFEREE_ASSIGNMENT_OPS_STATUS.ASSIGNED).toUpperCase();
}

/**
 * @param {{
 *   driver: object,
 *   clockIso?: string,
 * }} options
 */
export function createDurableRefereeOperationsStore(options = {}) {
  const driver = options.driver;
  const clockIso = isNonEmptyString(options.clockIso)
    ? String(options.clockIso).trim()
    : driver.clockIso || "2026-07-24T00:00:00.000Z";

  let commandContext = null;
  let seq = 0;

  function nextId(prefix) {
    seq += 1;
    return `${prefix}-${seq}`;
  }

  function currentActor() {
    return commandContext?.actor || null;
  }

  function reconstruct(tenantId, competitionId) {
    const record = emptyRecord(tenantId, competitionId);
    const assignmentRows = driver.listByCompetition({ tenantId, competitionId });
    record.assignments = assignmentRows.map((row) =>
      Object.freeze({
        assignmentId: `${row.matchId}::${row.refereeUserId}`,
        matchId: row.matchId,
        refereeId: row.refereeUserId,
        tenantId: row.tenantId,
        competitionId: row.competitionId,
        venueId: row.venueId || null,
        courtId: row.courtId || null,
        scheduledAt: row.assignedAt || null,
        status: opsStatusFromAssignment(row),
        participants: [],
        entries: [],
        checkInReady: false,
        source: "referee_assignments",
      })
    );
    const liveRows = driver.listLiveStates({ tenantId, competitionId });
    for (const live of liveRows) {
      const canonical = live.statePayload?.canonical || {};
      if (canonical.match) {
        record.matches[live.matchId] = clonePlain(canonical.match);
      }
      if (canonical.scoreSession) {
        record.scoreSessions[live.matchId] = clonePlain(canonical.scoreSession);
      }
      if (canonical.validation) {
        record.validationByMatch[live.matchId] = clonePlain(canonical.validation);
      }
      record.revision = Math.max(
        record.revision,
        Number(live.stateVersion ?? live.version ?? 0)
      );
      if (canonical.venueId) record.venueId = canonical.venueId;
    }
    record.updatedAt = clockIso;
    return record;
  }

  function persistMatchSlice(tenantId, competitionId, matchId, record, actor) {
    const actorId = requireCanonicalRefereeActor(actor);
    const scope = { tenantId, competitionId, matchId };
    if (!driver.getLiveState(scope)) {
      driver.ensureLiveState(
        {
          ...scope,
          status: mapCore15ToLiveStatus(record.matches?.[matchId]?.status),
          canonical: {},
        },
        actor
      );
    }
    const live = driver.getLiveState(scope);
    const canonical = {
      ...(live.statePayload?.canonical || {}),
      match: record.matches?.[matchId] || null,
      scoreSession: record.scoreSessions?.[matchId] || null,
      validation: record.validationByMatch?.[matchId] || null,
      venueId: record.venueId,
    };
    const nextState = {
      stateSchemaVersion: 1,
      matchId,
      status: mapCore15ToLiveStatus(canonical.match?.status),
      canonical,
    };
    const contentHash = hashCanonical({
      tenantId,
      competitionId,
      matchId,
      canonical,
      actorId,
    });
    const callerKey = String(
      commandContext?.idempotencyKey || commandContext?.commandId || ""
    ).trim();
    const idempotencyKey = callerKey
      ? `${callerKey}::${contentHash}`
      : contentHash;
    driver.commitTransition(
      {
        ...scope,
        expectedVersion: Number(live.stateVersion ?? live.version ?? 0),
        idempotencyKey,
        commandId: commandContext?.commandId || idempotencyKey,
        eventType: "E2E04_OPS_COMMIT",
        payload: { matchId, canonical },
        nextState,
        status: nextState.status,
      },
      actor
    );
  }

  function getOrCreate(tenantId, competitionId) {
    return deepFreeze(clonePlain(reconstruct(tenantId, competitionId)));
  }

  return Object.freeze({
    kind: "durable-referee-operations-store",
    classification: "DURABLE",
    durable: true,
    clockIso,
    setCommandContext(context) {
      commandContext = context || null;
    },
    get: getOrCreate,
    getRaw(tenantId, competitionId) {
      return clonePlain(reconstruct(tenantId, competitionId));
    },
    update(tenantId, competitionId, mutator) {
      const before = clonePlain(reconstruct(tenantId, competitionId));
      const draft = clonePlain(before);
      mutator(draft, { nextId, clockIso });
      draft.revision = Number(draft.revision || 0) + 1;
      draft.updatedAt = clockIso;
      const actor = currentActor();
      if (actor) {
        for (const row of draft.assignments || []) {
          driver.upsertAssignment(
            {
              tenantId,
              competitionId,
              matchId: row.matchId,
              refereeUserId: row.refereeId,
              opsStatus: row.status,
              status:
                row.status === REFEREE_ASSIGNMENT_OPS_STATUS.RELEASED ||
                row.status === REFEREE_ASSIGNMENT_OPS_STATUS.REASSIGNED
                  ? "revoked"
                  : "active",
              venueId: row.venueId || draft.venueId,
              courtId: row.courtId || null,
            },
            actor
          );
        }
      }
      const matchIds = new Set([
        ...Object.keys(before.matches || {}),
        ...Object.keys(draft.matches || {}),
        ...Object.keys(before.scoreSessions || {}),
        ...Object.keys(draft.scoreSessions || {}),
        ...Object.keys(before.validationByMatch || {}),
        ...Object.keys(draft.validationByMatch || {}),
      ]);
      if (actor) {
        for (const matchId of matchIds) {
          const beforeHash = hashCanonical({
            match: before.matches?.[matchId] || null,
            scoreSession: before.scoreSessions?.[matchId] || null,
            validation: before.validationByMatch?.[matchId] || null,
          });
          const afterHash = hashCanonical({
            match: draft.matches?.[matchId] || null,
            scoreSession: draft.scoreSessions?.[matchId] || null,
            validation: draft.validationByMatch?.[matchId] || null,
          });
          if (beforeHash !== afterHash) {
            persistMatchSlice(tenantId, competitionId, matchId, draft, actor);
          }
        }
      }
      return deepFreeze(clonePlain(reconstruct(tenantId, competitionId)));
    },
    upsertAssignments(tenantId, competitionId, assignments, meta = {}) {
      const actor = meta.actor || currentActor();
      requireCanonicalRefereeActor(actor);
      for (const raw of assignments || []) {
        const matchId = String(raw.matchId || "").trim();
        const refereeUserId = String(raw.refereeId || raw.assigneeId || "").trim();
        if (!matchId || !refereeUserId) continue;
        driver.upsertAssignment(
          {
            tenantId,
            competitionId,
            matchId,
            refereeUserId,
            opsStatus: raw.status || REFEREE_ASSIGNMENT_OPS_STATUS.ASSIGNED,
            status: "active",
            venueId: raw.venueId || meta.venueId || null,
            courtId: raw.courtId || null,
          },
          actor
        );
        driver.ensureLiveState(
          {
            tenantId,
            competitionId,
            matchId,
            canonical: { venueId: meta.venueId || raw.venueId || null },
          },
          actor
        );
      }
      return getOrCreate(tenantId, competitionId);
    },
    putMatch(tenantId, competitionId, match) {
      const matchId = String(match?.id || match?.matchId || "").trim();
      const actor = currentActor();
      const draft = clonePlain(reconstruct(tenantId, competitionId));
      if (matchId) draft.matches[matchId] = clonePlain(match);
      if (actor && matchId) {
        persistMatchSlice(tenantId, competitionId, matchId, draft, actor);
      }
      return getOrCreate(tenantId, competitionId);
    },
    nextId: (prefix = "ref-ops") => nextId(prefix),
    listKeys() {
      const keys = new Set();
      for (const row of driver.listByCompetition
        ? []
        : []) {
        keys.add(`${row.tenantId}::${row.competitionId}`);
      }
      return [...keys].sort();
    },
    matchStateId,
    REFEREE_ASSIGNMENT_OPS_STATUS,
  });
}
