/**
 * Official/Open referee → completion RPC adapter.
 * Token console uses anon. Organizer commands use authenticated session.
 */

import { canonicalRowToTournament } from "../mappers/canonicalTournamentMapper.js";
import {
  OFFICIAL_OPEN_LIFECYCLE_CODE,
  OFFICIAL_OPEN_LIFECYCLE_MESSAGES,
  OFFICIAL_OPEN_LIFECYCLE_RPC,
} from "./officialOpenLifecycleCodes.js";

let rpcOverride = null;

export function __setOfficialOpenLifecycleRpcForTests(rpc) {
  rpcOverride = typeof rpc === "function" ? rpc : null;
}

export function __resetOfficialOpenLifecycleRpcForTests() {
  rpcOverride = null;
}

export function newOfficialLifecycleIdempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isMissingRpcError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "");
  return code === "PGRST202" || (msg.includes("function") && msg.includes("not found"));
}

function normalizePayload(data) {
  if (data && typeof data === "object" && data.ok === false) {
    return {
      ...data,
      error: data.error || OFFICIAL_OPEN_LIFECYCLE_MESSAGES[data.code] || data.code,
    };
  }
  if (data && typeof data === "object" && data.ok === true) {
    const tournament =
      data.tournament && data.tournament.payload
        ? canonicalRowToTournament(data.tournament) || data.tournament
        : data.tournament;
    return { ...data, tournament };
  }
  if (data && typeof data === "object" && data.code && data.ok !== true) {
    return {
      ok: false,
      ...data,
      error: data.error || OFFICIAL_OPEN_LIFECYCLE_MESSAGES[data.code] || data.code,
    };
  }
  return { ok: true, data };
}

function failCloud(error) {
  if (isMissingRpcError(error)) {
    return {
      ok: false,
      code: OFFICIAL_OPEN_LIFECYCLE_CODE.SQL_NOT_APPLIED,
      error: OFFICIAL_OPEN_LIFECYCLE_MESSAGES[OFFICIAL_OPEN_LIFECYCLE_CODE.SQL_NOT_APPLIED],
    };
  }
  return {
    ok: false,
    code: OFFICIAL_OPEN_LIFECYCLE_CODE.CLOUD_UNAVAILABLE,
    error: String(error?.message || error || OFFICIAL_OPEN_LIFECYCLE_MESSAGES.CLOUD_UNAVAILABLE),
  };
}

export function createOfficialOpenLifecycleService(deps = {}) {
  async function callRpc(name, args, { anon = false } = {}) {
    const injected = deps.rpc || rpcOverride;
    if (typeof injected === "function") {
      try {
        return normalizePayload(await injected(name, args));
      } catch (error) {
        return failCloud(error);
      }
    }

    try {
      const { hasSupabaseConfig, getSupabaseAuthClient, getSupabaseAnonRpcClient } = await import(
        "../../../auth/supabaseClient.js"
      );
      if (!hasSupabaseConfig()) {
        return failCloud(new Error("Supabase chưa cấu hình."));
      }

      const client = anon ? getSupabaseAnonRpcClient() : getSupabaseAuthClient();
      if (!client?.rpc) {
        return failCloud(new Error("Supabase RPC không sẵn sàng."));
      }
      const { data, error } = await client.rpc(name, args);
      if (error) {
        return failCloud(error);
      }
      return normalizePayload(data);
    } catch (error) {
      return failCloud(error);
    }
  }

  return {
    async listMyRefereeAssignments() {
      return callRpc(OFFICIAL_OPEN_LIFECYCLE_RPC.LIST_MY_REFEREE_ASSIGNMENTS, {});
    },
    async openMyRefereeMatch(input = {}) {
      return callRpc(OFFICIAL_OPEN_LIFECYCLE_RPC.OPEN_MY_REFEREE_MATCH, {
        p_tournament_id: input.tournamentId,
        p_match_id: input.matchId,
      });
    },
    async ensureMatchLive(input = {}) {
      return callRpc(OFFICIAL_OPEN_LIFECYCLE_RPC.ENSURE_LIVE, {
        p_tenant_id: input.tenantId,
        p_club_id: input.clubId,
        p_tournament_id: input.tournamentId,
        p_match_id: input.matchId,
        p_labels: input.labels || {},
      });
    },
    async revokeMatchLive(input = {}) {
      return callRpc(OFFICIAL_OPEN_LIFECYCLE_RPC.REVOKE_LIVE, {
        p_tenant_id: input.tenantId,
        p_club_id: input.clubId,
        p_tournament_id: input.tournamentId,
        p_match_id: input.matchId,
      });
    },
    async refereeGetMatch(token) {
      return callRpc(
        OFFICIAL_OPEN_LIFECYCLE_RPC.REFEREE_GET,
        { p_token: token },
        { anon: true }
      );
    },
    async adjustLiveScore(input = {}) {
      return callRpc(
        OFFICIAL_OPEN_LIFECYCLE_RPC.ADJUST_LIVE,
        {
          p_token: input.token,
          p_team: input.team,
          p_delta: input.delta,
          p_expected_score_a: Number(input.expectedScoreA),
          p_expected_score_b: Number(input.expectedScoreB),
        },
        { anon: true }
      );
    },
    async commitMatchResult(input = {}) {
      return callRpc(
        OFFICIAL_OPEN_LIFECYCLE_RPC.COMMIT_RESULT,
        {
          p_token: input.token,
          p_score_a: Number(input.scoreA),
          p_score_b: Number(input.scoreB),
          p_idempotency_key:
            input.idempotencyKey || newOfficialLifecycleIdempotencyKey("commit"),
        },
        { anon: true }
      );
    },
    async adminCommitMatchResult(input = {}) {
      return callRpc(OFFICIAL_OPEN_LIFECYCLE_RPC.ADMIN_COMMIT, {
        p_tenant_id: input.tenantId,
        p_club_id: input.clubId,
        p_tournament_id: input.tournamentId,
        p_match_id: input.matchId,
        p_score_a: Number(input.scoreA),
        p_score_b: Number(input.scoreB),
        p_expected_version: Number(input.expectedVersion),
        p_idempotency_key:
          input.idempotencyKey || newOfficialLifecycleIdempotencyKey("admin-commit"),
      });
    },
    async generateKnockout(input = {}) {
      return callRpc(OFFICIAL_OPEN_LIFECYCLE_RPC.GENERATE_KNOCKOUT, {
        p_tenant_id: input.tenantId,
        p_club_id: input.clubId,
        p_tournament_id: input.tournamentId,
        p_event_id: input.eventId || "",
        p_expected_version: Number(input.expectedVersion),
        p_idempotency_key:
          input.idempotencyKey || newOfficialLifecycleIdempotencyKey("generate-ko"),
      });
    },
    async completeTournament(input = {}) {
      return callRpc(OFFICIAL_OPEN_LIFECYCLE_RPC.COMPLETE, {
        p_tenant_id: input.tenantId,
        p_club_id: input.clubId,
        p_tournament_id: input.tournamentId,
        p_expected_version: Number(input.expectedVersion),
        p_idempotency_key:
          input.idempotencyKey || newOfficialLifecycleIdempotencyKey("complete"),
      });
    },
    async getPublicResults(input = {}) {
      return callRpc(OFFICIAL_OPEN_LIFECYCLE_RPC.PUBLIC_RESULTS, {
        p_tenant_id: input.tenantId,
        p_club_id: input.clubId,
        p_tournament_id: input.tournamentId,
      });
    },
  };
}

export const officialOpenLifecycleService = createOfficialOpenLifecycleService();
