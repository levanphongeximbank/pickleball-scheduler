/**
 * Production durable driver over Referee V5 tables + internal service-role commit RPCs.
 *
 * Server/Edge only. Browser callers are rejected by privileged composition guard.
 * Does not call Referee V5 scoring/lifecycle/finalize engines.
 * Does not call Team Tournament bridge/assert RPCs.
 */

import {
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
  LIVE_RESULT_STATUS,
  LIVE_RPC_DRIVER_KIND,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_V5_INTERNAL_COMMIT_RPC,
} from "./constants.js";
import { failRefereeAdapter } from "./errors.js";
import { freezeClone, hashCanonical, isNonEmptyString, matchStateId } from "./helpers.js";
import { assertServerOnlyPrivilegedRefereeComposition } from "./privilegedCompositionBoundary.js";
import { requireCanonicalRefereeActor } from "./requireCanonicalRefereeActor.js";

function mapRpcFailure(data) {
  const code = String(data?.code || "");
  if (code === "REFEREE_NOT_ASSIGNED") {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED,
      "Referee is not assigned to this match",
      { rpcCode: code }
    );
  }
  if (code === "MATCH_STATE_CONFLICT" || code === "EVENT_SEQUENCE_CONFLICT") {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE,
      "Fail-closed stale write: expectedVersion mismatch",
      { rpcCode: code, currentVersion: data?.currentVersion }
    );
  }
  if (code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.IDEMPOTENCY_CONFLICT,
      "Same idempotencyKey with a conflicting request is fail-closed",
      { rpcCode: code }
    );
  }
  failRefereeAdapter(
    REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
    data?.error || code || "Durable RPC commit failed",
    { rpcCode: code }
  );
}

function mapLiveRow(row) {
  if (!row) return null;
  return freezeClone({
    table: CANONICAL_REFEREE_PERSISTENCE_TABLES.LIVE_STATES,
    id: row.id,
    tenantId: row.tenant_id,
    competitionId: row.tournament_id,
    tournamentId: row.tournament_id,
    matchId: row.match_id,
    version: Number(row.version ?? row.state_version ?? 0),
    stateVersion: Number(row.state_version ?? row.version ?? 0),
    lastEventSequence: Number(row.last_event_sequence || 0),
    status: row.status,
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
    statePayload: row.state_payload || null,
    stateHash: row.state_hash || null,
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
  });
}

function mapAssignmentRow(row) {
  if (!row) return null;
  return freezeClone({
    table: CANONICAL_REFEREE_PERSISTENCE_TABLES.ASSIGNMENTS,
    tenantId: row.tenant_id,
    competitionId: row.tournament_id,
    tournamentId: row.tournament_id,
    matchId: row.match_id,
    refereeUserId: row.referee_user_id,
    role: row.role,
    status: row.status,
    opsStatus: row.status === "revoked" ? "RELEASED" : "ASSIGNED",
    assignedAt: row.assigned_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    version: Number(row.version || 1),
  });
}

function isActiveAssignment(row, nowIso) {
  if (!row || row.status !== "active") return false;
  if (row.revoked_at) return false;
  if (row.expires_at && String(row.expires_at) <= String(nowIso)) {
    return false;
  }
  return true;
}

/**
 * @param {{ rpcClient?: { rpc: Function, from?: Function }, clockIso?: string }} [options]
 */
export function createLiveRpcCanonicalRefereeDurableDriver(options = {}) {
  assertServerOnlyPrivilegedRefereeComposition();
  const rpcClient = options.rpcClient;
  if (!rpcClient || typeof rpcClient.rpc !== "function" || typeof rpcClient.from !== "function") {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "Live RPC durable driver requires a service-role rpcClient with rpc() and from()",
      {}
    );
  }

  const clockIso = isNonEmptyString(options.clockIso)
    ? String(options.clockIso).trim()
    : "2026-07-24T00:00:00.000Z";

  async function getLiveState(scope) {
    const id = matchStateId(scope.tenantId, scope.competitionId, scope.matchId);
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.LIVE_STATES)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to read match_live_states",
        {}
      );
    }
    return mapLiveRow(data);
  }

  async function listLiveStates({ tenantId, competitionId }) {
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.LIVE_STATES)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("tournament_id", competitionId);
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to list match_live_states",
        {}
      );
    }
    return Object.freeze((data || []).map(mapLiveRow));
  }

  async function ensureLiveState(input, actor) {
    requireCanonicalRefereeActor(actor);
    const tenantId = String(input.tenantId || "").trim();
    const competitionId = String(input.competitionId || input.tournamentId || "").trim();
    const matchId = String(input.matchId || "").trim();
    const id = matchStateId(tenantId, competitionId, matchId);
    const existing = await getLiveState({ tenantId, competitionId, matchId });
    if (existing) return existing;

    const statePayload = {
      stateSchemaVersion: 1,
      matchId,
      version: 0,
      lastEventSequence: 0,
      status: input.status || "not_started",
      canonical: input.canonical || {},
    };
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.LIVE_STATES)
      .upsert(
        {
          id,
          tenant_id: tenantId,
          tournament_id: competitionId,
          match_id: matchId,
          team_a_id: input.teamAId || "SIDE_A",
          team_b_id: input.teamBId || "SIDE_B",
          state_payload: statePayload,
          state_version: 0,
          version: 0,
          last_event_sequence: 0,
          status: input.status || "not_started",
        },
        { onConflict: "id" }
      )
      .select("*")
      .maybeSingle();
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to ensure match_live_states",
        {}
      );
    }
    return mapLiveRow(data) || (await getLiveState({ tenantId, competitionId, matchId }));
  }

  async function upsertAssignment(row, actor) {
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
    const status = String(row.status || "active");
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.ASSIGNMENTS)
      .upsert(
        {
          tenant_id: tenantId,
          tournament_id: competitionId,
          match_id: matchId,
          referee_user_id: refereeUserId,
          referee_display_name: row.refereeDisplayName || "CE Adapter B Cert",
          role: row.role || "REFEREE",
          status,
          assigned_by: actorId,
          assigned_at: clockIso,
          expires_at: row.expiresAt || null,
          revoked_at: status === "revoked" ? clockIso : null,
          version: Number(row.version || 1),
        },
        { onConflict: "tenant_id,tournament_id,match_id,role,referee_user_id" }
      )
      .select("*")
      .maybeSingle();
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to upsert referee_assignments",
        {}
      );
    }
    return mapAssignmentRow(data);
  }

  async function listByCompetition({ tenantId, competitionId }) {
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.ASSIGNMENTS)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("tournament_id", competitionId);
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to list referee_assignments",
        {}
      );
    }
    return Object.freeze((data || []).map(mapAssignmentRow));
  }

  async function getAssignment(scope) {
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.ASSIGNMENTS)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("tournament_id", scope.competitionId)
      .eq("match_id", scope.matchId)
      .eq("referee_user_id", scope.refereeUserId)
      .maybeSingle();
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to read referee_assignments",
        {}
      );
    }
    if (!data || !isActiveAssignment(data, clockIso)) return null;
    return mapAssignmentRow(data);
  }

  async function listByReferee({ tenantId, refereeUserId }) {
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.ASSIGNMENTS)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("referee_user_id", refereeUserId)
      .eq("status", "active");
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to list assignments by referee",
        {}
      );
    }
    return Object.freeze(
      (data || [])
        .filter((row) => isActiveAssignment(row, clockIso))
        .map(mapAssignmentRow)
    );
  }

  async function listEvents(scope) {
    const id = matchStateId(scope.tenantId, scope.competitionId, scope.matchId);
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.EVENTS)
      .select("*")
      .eq("match_state_id", id)
      .order("event_sequence", { ascending: true });
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to list match_events",
        {}
      );
    }
    return Object.freeze(
      (data || []).map((row) =>
        freezeClone({
          table: CANONICAL_REFEREE_PERSISTENCE_TABLES.EVENTS,
          id: row.id,
          tenantId: row.tenant_id,
          competitionId: row.tournament_id,
          matchId: row.match_id,
          matchStateId: row.match_state_id,
          eventSequence: Number(row.event_sequence),
          eventType: row.event_type,
          payload: row.payload,
          stateVersionBefore: row.state_version_before,
          stateVersionAfter: row.state_version_after,
          actorId: row.actor_id,
          idempotencyKey: row.idempotency_key,
          appendOnly: true,
        })
      )
    );
  }

  async function findIdempotent(scope) {
    if (!scope.idempotencyKey) return null;
    const id = matchStateId(scope.tenantId, scope.competitionId, scope.matchId);
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.SYNC_MUTATIONS)
      .select("*")
      .eq("match_state_id", id)
      .eq("idempotency_key", scope.idempotencyKey)
      .maybeSingle();
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to read match_sync_mutations",
        {}
      );
    }
    return data
      ? freezeClone({
          table: CANONICAL_REFEREE_PERSISTENCE_TABLES.SYNC_MUTATIONS,
          tenantId: data.tenant_id,
          matchStateId: data.match_state_id,
          matchId: data.match_id,
          idempotencyKey: data.idempotency_key,
          requestHash: data.request_hash,
          responsePayload: data.response_payload,
          status: data.status,
          resultingStateVersion: data.resulting_state_version,
          resultingEventSequence: data.resulting_event_sequence,
        })
      : null;
  }

  async function commitTransition(input, actor) {
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

    let live = await getLiveState({ tenantId, competitionId, matchId });
    if (!live) {
      live = await ensureLiveState(
        {
          tenantId,
          competitionId,
          matchId,
          status: input.status || "not_started",
          canonical: input.nextState?.canonical || {},
        },
        actor
      );
    }

    const currentVersion = Number(live.stateVersion ?? live.version ?? 0);
    const currentSequence = Number(live.lastEventSequence || 0);
    const expectedVersion =
      input.expectedVersion != null ? Number(input.expectedVersion) : currentVersion;
    const expectedSequence =
      input.expectedEventSequence != null
        ? Number(input.expectedEventSequence)
        : currentSequence;

    const nextVersion = currentVersion + 1;
    const nextSequence = currentSequence + 1;
    const nextState = freezeClone({
      ...(input.nextState || live.statePayload || {}),
      stateSchemaVersion: 1,
      matchId,
      version: nextVersion,
      lastEventSequence: nextSequence,
      status: input.status || input.nextState?.status || live.status || "not_started",
    });

    // Hash caller intent only — never include auto-bumped version/sequence, or
    // idempotent replay against a newer live row would collide on request_hash.
    const requestHash =
      input.requestHash ||
      hashCanonical({
        commandType: input.eventType || input.commandType || "E2E04_OPS_COMMIT",
        payload: input.payload || {},
        nextState: input.nextState || {},
        status: input.status || input.nextState?.status || null,
      });

    const { data, error } = await rpcClient.rpc(
      REFEREE_V5_INTERNAL_COMMIT_RPC.COMMIT_TRANSITION,
      {
        p_tenant_id: tenantId,
        p_tournament_id: competitionId,
        p_match_id: matchId,
        p_actor_id: actorId,
        p_command_type: input.eventType || input.commandType || "E2E04_OPS_COMMIT",
        p_command_payload: input.payload || {},
        p_expected_state_version: expectedVersion,
        p_expected_event_sequence: expectedSequence,
        // Staging enforces UNIQUE(match_state_id, client_mutation_id). One facade
        // command may emit multiple durable writes — always use the per-write
        // idempotencyKey (includes content hash), never a shared commandId alone.
        p_client_mutation_id: idempotencyKey,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
        p_next_state: nextState,
        p_generated_events: input.generatedEvents || [],
        p_state_before_hash: input.stateBeforeHash || null,
        p_state_after_hash: input.stateAfterHash || hashCanonical(nextState),
        p_state_before: input.stateBefore || live.statePayload || null,
      }
    );
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "RPC error",
        {}
      );
    }
    if (data?.ok === false) mapRpcFailure(data);

    const refreshed = await getLiveState({ tenantId, competitionId, matchId });
    return freezeClone({
      ok: true,
      duplicate: Boolean(data?.duplicate),
      live: refreshed,
      stateVersion: Number(data?.stateVersion ?? nextVersion),
      lastEventSequence: Number(data?.lastEventSequence ?? nextSequence),
      event: {
        eventType: input.eventType || "E2E04_OPS_COMMIT",
        eventSequence: Number(data?.lastEventSequence ?? nextSequence),
        idempotencyKey,
      },
    });
  }

  async function appendRevision(input, actor) {
    const actorId = requireCanonicalRefereeActor(actor);
    const tenantId = String(input.tenantId || "").trim();
    const competitionId = String(input.competitionId || "").trim();
    const matchId = String(input.matchId || "").trim();
    const acceptanceStatus = String(input.acceptanceStatus || "").trim();
    if (acceptanceStatus && acceptanceStatus !== "ACCEPTED") {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.UNOFFICIAL_RESULT_FORBIDDEN,
        "Unaccepted results cannot persist as official revisions",
        { acceptanceStatus }
      );
    }

    const { data: existing, error: listError } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.RESULT_REVISIONS)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("tournament_id", competitionId)
      .eq("match_id", matchId)
      .order("revision", { ascending: true });
    if (listError) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        listError.message || "Failed to list match_result_revisions",
        {}
      );
    }
    const list = existing || [];
    const nextRevision = list.length + 1;
    const idempotencyKey =
      String(input.idempotencyKey || "").trim() ||
      `rev-${matchStateId(tenantId, competitionId, matchId)}-${nextRevision}`;
    const existingByKey = list.find((row) => row.idempotency_key === idempotencyKey);
    if (existingByKey) {
      return freezeClone({
        revision: existingByKey.revision,
        lineageStatus: "ACTIVE",
        liveStatus: LIVE_RESULT_STATUS.CONFIRMED,
        acceptanceStatus: "ACCEPTED",
        duplicate: true,
        payload: existingByKey.final_score,
      });
    }

    for (const row of list) {
      if (row.status === "confirmed") {
        await rpcClient
          .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.RESULT_REVISIONS)
          .update({ status: "overridden" })
          .eq("id", row.id);
      }
    }

    const payload = input.payload || {};
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.RESULT_REVISIONS)
      .insert({
        tenant_id: tenantId,
        tournament_id: competitionId,
        match_id: matchId,
        revision: nextRevision,
        status: "confirmed",
        team_a_id: payload.teamAId || "SIDE_A",
        team_b_id: payload.teamBId || "SIDE_B",
        winner_team_id: payload.winnerTeamId || payload.winnerSide || null,
        final_score: payload.finalScore || payload,
        games: payload.games || [],
        completion_reason: payload.completionReason || "COMPLETED",
        finalized_by: actorId,
        finalized_at: clockIso,
        idempotency_key: idempotencyKey,
        supersedes_revision: list.length ? list[list.length - 1].revision : null,
        confirmed_by: actorId,
        confirmed_at: clockIso,
        created_by: actorId,
      })
      .select("*")
      .maybeSingle();
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to append match_result_revisions",
        {}
      );
    }
    return freezeClone({
      revision: data.revision,
      lineageStatus: "ACTIVE",
      liveStatus:
        list.length > 0 ? LIVE_RESULT_STATUS.OVERRIDDEN : LIVE_RESULT_STATUS.CONFIRMED,
      acceptanceStatus: "ACCEPTED",
      duplicate: false,
      payload: data.final_score,
      idempotencyKey,
    });
  }

  async function getActiveRevision(scope) {
    const { data, error } = await rpcClient
      .from(CANONICAL_REFEREE_PERSISTENCE_TABLES.RESULT_REVISIONS)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("tournament_id", scope.competitionId)
      .eq("match_id", scope.matchId)
      .eq("status", "confirmed")
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        error.message || "Failed to read active revision",
        {}
      );
    }
    if (!data) return null;
    return freezeClone({
      revision: data.revision,
      lineageStatus: "ACTIVE",
      liveStatus: LIVE_RESULT_STATUS.CONFIRMED,
      acceptanceStatus: "ACCEPTED",
      payload: data.final_score,
      idempotencyKey: data.idempotency_key,
    });
  }

  return Object.freeze({
    kind: LIVE_RPC_DRIVER_KIND,
    classification: DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
    durable: true,
    mirrorsLiveSchema: true,
    usesLiveRpc: true,
    usesRefereeV5ScoringEngine: false,
    usesTeamBridge: false,
    tables: CANONICAL_REFEREE_PERSISTENCE_TABLES,
    rpcNames: REFEREE_V5_INTERNAL_COMMIT_RPC,
    clockIso,
    getLiveState,
    listLiveStates,
    ensureLiveState,
    upsertAssignment,
    getAssignment,
    listByReferee,
    listByCompetition,
    listEvents,
    findIdempotent,
    commitTransition,
    appendRevision,
    getActiveRevision,
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
    matchStateId,
  });
}
