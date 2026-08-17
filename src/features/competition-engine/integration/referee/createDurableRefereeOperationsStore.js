/**
 * E2E-04 ops store backed by canonical durable tables.
 * Reconstructs F5/fresh-tab state from durable snapshots only.
 * Driver methods may be sync (schema-faithful) or async (live RPC).
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
    courtsByMatch: {},
    validationByMatch: {},
    revision: 0,
  };
}

function opsStatusFromAssignment(row) {
  if (row.status === "revoked") return REFEREE_ASSIGNMENT_OPS_STATUS.RELEASED;
  return String(row.opsStatus || REFEREE_ASSIGNMENT_OPS_STATUS.ASSIGNED).toUpperCase();
}

async function resolve(value) {
  return await value;
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

  async function reconstruct(tenantId, competitionId) {
    const record = emptyRecord(tenantId, competitionId);
    const assignmentRows = await resolve(
      driver.listByCompetition({ tenantId, competitionId })
    );
    record.assignments = (assignmentRows || []).map((row) =>
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
    const liveRows = await resolve(
      driver.listLiveStates({ tenantId, competitionId })
    );
    for (const live of liveRows || []) {
      const canonical = live.statePayload?.canonical || {};
      if (canonical.match) {
        record.matches[live.matchId] = clonePlain(canonical.match);
      }
      if (canonical.scoreSession) {
        record.scoreSessions[live.matchId] = clonePlain(canonical.scoreSession);
      }
      if (canonical.court) {
        record.courtsByMatch[live.matchId] = clonePlain(canonical.court);
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

  async function persistMatchSlice(tenantId, competitionId, matchId, record, actor) {
    const actorId = requireCanonicalRefereeActor(actor);
    const scope = { tenantId, competitionId, matchId };
    // Prefer request-local live from CAS pre-read — avoid a duplicate getLiveState.
    let live =
      commandContext?.currentLive &&
      String(commandContext.currentLive.matchId || "") === String(matchId)
        ? commandContext.currentLive
        : null;
    if (!live) {
      live = await resolve(driver.getLiveState(scope));
    }
    if (!live) {
      await resolve(
        driver.ensureLiveState(
          {
            ...scope,
            status: mapCore15ToLiveStatus(record.matches?.[matchId]?.status),
            canonical: {},
          },
          actor
        )
      );
      live = await resolve(driver.getLiveState(scope));
    }
    const canonical = {
      ...(live.statePayload?.canonical || {}),
      match: record.matches?.[matchId] || null,
      scoreSession: record.scoreSessions?.[matchId] || null,
      court:
        record.courtsByMatch?.[matchId] != null
          ? record.courtsByMatch[matchId]
          : live.statePayload?.canonical?.court || null,
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
    const committed = await resolve(
      driver.commitTransition(
        {
          ...scope,
          currentLive: live,
          expectedVersion: Number(live.stateVersion ?? live.version ?? 0),
          expectedEventSequence: Number(live.lastEventSequence || 0),
          idempotencyKey,
          commandId: commandContext?.commandId || idempotencyKey,
          eventType: "E2E04_OPS_COMMIT",
          payload: { matchId, canonical },
          nextState,
          status: nextState.status,
        },
        actor
      )
    );
    if (commandContext) {
      commandContext.commitSubphases = committed?.commitSubphases || null;
    }
    return committed?.live || null;
  }

  async function getOrCreate(tenantId, competitionId) {
    return deepFreeze(clonePlain(await reconstruct(tenantId, competitionId)));
  }

  return Object.freeze({
    kind: "durable-referee-operations-store",
    classification: "DURABLE",
    durable: true,
    clockIso,
    setCommandContext(context) {
      commandContext = context || null;
    },
    getLastCommittedLive() {
      return commandContext?.lastCommittedLive || null;
    },
    getCommitSubphases() {
      return commandContext?.commitSubphases || null;
    },
    get: getOrCreate,
    async getRaw(tenantId, competitionId) {
      return clonePlain(await reconstruct(tenantId, competitionId));
    },
    async update(tenantId, competitionId, mutator) {
      // Hot score path: reuse request-local seedRecord (single-match) — no competition-wide
      // listByCompetition / listLiveStates reconstruct.
      const seeded =
        commandContext?.seedRecord &&
        String(commandContext.seedRecord.tenantId || "") === String(tenantId || "") &&
        String(commandContext.seedRecord.competitionId || "") ===
          String(competitionId || "")
          ? commandContext.seedRecord
          : null;
      const before = clonePlain(
        seeded || (await reconstruct(tenantId, competitionId))
      );
      const draft = clonePlain(before);
      mutator(draft, { nextId, clockIso });
      draft.revision = Number(draft.revision || 0) + 1;
      draft.updatedAt = clockIso;
      const actor = currentActor();
      const assignmentsChanged =
        hashCanonical(before.assignments || []) !==
        hashCanonical(draft.assignments || []);
      // submitPoint must not rewrite unchanged assignment rows.
      if (actor && assignmentsChanged) {
        for (const row of draft.assignments || []) {
          await resolve(
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
            )
          );
        }
      }
      const matchIds = new Set([
        ...Object.keys(before.matches || {}),
        ...Object.keys(draft.matches || {}),
        ...Object.keys(before.scoreSessions || {}),
        ...Object.keys(draft.scoreSessions || {}),
        ...Object.keys(before.courtsByMatch || {}),
        ...Object.keys(draft.courtsByMatch || {}),
        ...Object.keys(before.validationByMatch || {}),
        ...Object.keys(draft.validationByMatch || {}),
      ]);
      let lastCommittedLive = null;
      if (actor) {
        for (const matchId of matchIds) {
          const beforeHash = hashCanonical({
            match: before.matches?.[matchId] || null,
            scoreSession: before.scoreSessions?.[matchId] || null,
            court: before.courtsByMatch?.[matchId] || null,
            validation: before.validationByMatch?.[matchId] || null,
          });
          const afterHash = hashCanonical({
            match: draft.matches?.[matchId] || null,
            scoreSession: draft.scoreSessions?.[matchId] || null,
            court: draft.courtsByMatch?.[matchId] || null,
            validation: draft.validationByMatch?.[matchId] || null,
          });
          if (beforeHash !== afterHash) {
            lastCommittedLive = await persistMatchSlice(
              tenantId,
              competitionId,
              matchId,
              draft,
              actor
            );
          }
        }
      }
      if (commandContext) {
        commandContext.lastCommittedLive = lastCommittedLive;
      }
      // Avoid a second full competition reconstruct after commit — draft is authoritative
      // for the mutated slices just persisted.
      return deepFreeze(clonePlain(draft));
    },
    async upsertAssignments(tenantId, competitionId, assignments, meta = {}) {
      const actor = meta.actor || currentActor();
      requireCanonicalRefereeActor(actor);
      for (const raw of assignments || []) {
        const matchId = String(raw.matchId || "").trim();
        const refereeUserId = String(raw.refereeId || raw.assigneeId || "").trim();
        if (!matchId || !refereeUserId) continue;
        await resolve(
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
          )
        );
        await resolve(
          driver.ensureLiveState(
            {
              tenantId,
              competitionId,
              matchId,
              canonical: { venueId: meta.venueId || raw.venueId || null },
            },
            actor
          )
        );
      }
      return getOrCreate(tenantId, competitionId);
    },
    async putMatch(tenantId, competitionId, match) {
      const matchId = String(match?.id || match?.matchId || "").trim();
      const actor = currentActor();
      const draft = clonePlain(await reconstruct(tenantId, competitionId));
      if (matchId) draft.matches[matchId] = clonePlain(match);
      if (actor && matchId) {
        await persistMatchSlice(tenantId, competitionId, matchId, draft, actor);
      }
      return getOrCreate(tenantId, competitionId);
    },
    nextId: (prefix = "ref-ops") => nextId(prefix),
    listKeys() {
      return [];
    },
    matchStateId,
    REFEREE_ASSIGNMENT_OPS_STATUS,
  });
}
