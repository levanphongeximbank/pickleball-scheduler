import { buildMatchStateId, deserializeMatchState, serializeMatchState } from "./matchStateSerializer.js";

/**
 * Supabase service-role reads for Edge Function compute phase.
 */
export class RefereeV5SupabaseRepository {
  constructor(serviceClient) {
    this.client = serviceClient;
  }

  async findAssignmentByUserAndMatch({ userId, tournamentId, matchId }) {
    const { data, error } = await this.client
      .from("referee_assignments")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("match_id", matchId)
      .eq("referee_user_id", userId)
      .order("status", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.mapAssignment(data);
  }

  async getAssignment({ tenantId, tournamentId, matchId, userId }) {
    const { data, error } = await this.client
      .from("referee_assignments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("tournament_id", tournamentId)
      .eq("match_id", matchId)
      .eq("referee_user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.mapAssignment(data);
  }

  mapAssignment(row) {
    return {
      tenantId: row.tenant_id,
      tournamentId: row.tournament_id,
      matchId: row.match_id,
      userId: row.referee_user_id,
      assignmentRole: row.role,
      status: row.status,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    };
  }

  async getLiveState(matchStateId) {
    const { data, error } = await this.client
      .from("match_live_states")
      .select("*")
      .eq("id", matchStateId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      tenantId: data.tenant_id,
      tournamentId: data.tournament_id,
      matchId: data.match_id,
      stateVersion: data.state_version ?? data.version ?? 0,
      lastEventSequence: data.last_event_sequence ?? 0,
      status: data.status,
      statePayload: data.state_payload,
      teamAId: data.team_a_id,
      teamBId: data.team_b_id,
    };
  }

  async getInitialState(matchStateId) {
    const { data: firstEvent } = await this.client
      .from("match_events")
      .select("command_payload, state_version_before")
      .eq("match_state_id", matchStateId)
      .eq("state_version_before", 0)
      .order("event_sequence", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstEvent?.command_payload?._initialState) {
      return deserializeMatchState(firstEvent.command_payload._initialState);
    }

    const live = await this.getLiveState(matchStateId);
    if (!live?.statePayload) {
      return null;
    }
    const state = deserializeMatchState(live.statePayload);
    if ((state?.version ?? 0) === 0) {
      return state;
    }
    return null;
  }

  async getEvents(matchStateId) {
    const { data, error } = await this.client
      .from("match_events")
      .select("*")
      .eq("match_state_id", matchStateId)
      .order("event_sequence", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      event_type: row.event_type,
      command_type: row.command_type || row.event_type,
      event_sequence: row.event_sequence,
      state_version_before: row.state_version_before,
      state_version_after: row.state_version_after,
      command_payload: row.command_payload || row.payload || {},
      actor_id: row.actor_id,
      idempotency_key: row.idempotency_key,
    }));
  }

  async findIdempotency(matchStateId, idempotencyKey) {
    if (!idempotencyKey) {
      return null;
    }

    const { data, error } = await this.client
      .from("match_sync_mutations")
      .select("*")
      .eq("match_state_id", matchStateId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      requestHash: data.request_hash,
      responsePayload: data.response_payload,
      status: data.status,
    };
  }

  async saveIdempotency() {
    return { ok: true };
  }

  async appendAudit() {
    return { ok: true };
  }

  async atomicTransaction(_matchStateId, fn) {
    return fn();
  }

  async appendEventAndSnapshot() {
    return { ok: false, code: "USE_RPC_COMMIT" };
  }
}

export { buildMatchStateId, serializeMatchState };
