/**
 * Daily Play canonical service — RPC adapter with fail-closed cloud path.
 * Inject `rpc` / authority for tests. Never falls back to club blob courts.
 */

import { DAILY_PLAY_CODE, DAILY_PLAY_MESSAGES, DAILY_PLAY_RPC } from "./dailyPlayCodes.js";
import { resolveCreateMatchCount } from "./dailyPlayCanonicalDomain.js";
import { normalizeDailyPlayServerSnapshot } from "./normalizeDailyPlayServerSnapshot.js";

function normalizeRpcPayload(data) {
  if (data && typeof data === "object" && "ok" in data) return data;
  return { ok: true, data };
}

function newIdempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {{ rpc?: Function }} [deps]
 */
export function createDailyPlayCanonicalService(deps = {}) {
  async function callRpc(name, args) {
    if (typeof deps.rpc === "function") {
      try {
        return normalizeRpcPayload(await deps.rpc(name, args));
      } catch (error) {
        return {
          ok: false,
          code: DAILY_PLAY_CODE.CLOUD_UNAVAILABLE,
          error: String(error?.message || error),
        };
      }
    }

    try {
      const { hasSupabaseConfig, getSupabaseAuthClient } = await import(
        "../../../auth/supabaseClient.js"
      );
      if (!hasSupabaseConfig()) {
        return {
          ok: false,
          code: DAILY_PLAY_CODE.CLOUD_UNAVAILABLE,
          error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.CLOUD_UNAVAILABLE],
        };
      }
      const client = getSupabaseAuthClient();
      if (!client?.rpc) {
        return {
          ok: false,
          code: DAILY_PLAY_CODE.CLOUD_UNAVAILABLE,
          error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.CLOUD_UNAVAILABLE],
        };
      }
      const { data, error } = await client.rpc(name, args);
      if (error) {
        return {
          ok: false,
          code: DAILY_PLAY_CODE.CLOUD_UNAVAILABLE,
          error: String(error.message || error),
        };
      }
      return normalizeRpcPayload(data);
    } catch (error) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.CLOUD_UNAVAILABLE,
        error: String(error?.message || error),
      };
    }
  }

  function scopeArgs(scope = {}) {
    return {
      p_tenant_id: scope.tenantId,
      p_club_id: scope.clubId,
      p_tournament_id: scope.tournamentId,
    };
  }

  return {
    async getState(scope) {
      const raw = await callRpc(DAILY_PLAY_RPC.GET_STATE, scopeArgs(scope));
      if (!raw?.ok) return raw;
      return normalizeDailyPlayServerSnapshot(raw);
    },

    async checkIn(scope, { playerId, expectedVersion, idempotencyKey }) {
      return callRpc(DAILY_PLAY_RPC.CHECK_IN, {
        ...scopeArgs(scope),
        p_player_id: String(playerId),
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey || newIdempotencyKey("checkin"),
      });
    },

    async checkOut(scope, { playerId, expectedVersion, idempotencyKey }) {
      return callRpc(DAILY_PLAY_RPC.CHECK_OUT, {
        ...scopeArgs(scope),
        p_player_id: String(playerId),
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey || newIdempotencyKey("checkout"),
      });
    },

    async createMatches(
      scope,
      { matches, expectedVersion, eligiblePlayerCount, idempotencyKey }
    ) {
      return callRpc(DAILY_PLAY_RPC.CREATE_MATCHES, {
        ...scopeArgs(scope),
        p_matches: matches || [],
        p_eligible_player_count: eligiblePlayerCount ?? null,
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey || newIdempotencyKey("create"),
      });
    },

    async assignCourt(scope, { matchId, courtId = null, expectedVersion, idempotencyKey }) {
      return callRpc(DAILY_PLAY_RPC.ASSIGN_COURT, {
        ...scopeArgs(scope),
        p_match_id: String(matchId),
        p_court_id: courtId == null ? null : String(courtId),
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey || newIdempotencyKey("assign"),
      });
    },

    async startMatch(scope, { matchId, expectedVersion, idempotencyKey }) {
      return callRpc(DAILY_PLAY_RPC.START_MATCH, {
        ...scopeArgs(scope),
        p_match_id: String(matchId),
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey || newIdempotencyKey("start"),
      });
    },

    async submitScore(
      scope,
      { matchId, scoreA, scoreB, expectedVersion, idempotencyKey }
    ) {
      return callRpc(DAILY_PLAY_RPC.SUBMIT_SCORE, {
        ...scopeArgs(scope),
        p_match_id: String(matchId),
        p_score_a: Number(scoreA),
        p_score_b: Number(scoreB),
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey || newIdempotencyKey("score"),
      });
    },

    async correctScore(
      scope,
      { matchId, scoreA, scoreB, note = "", expectedVersion, idempotencyKey }
    ) {
      return callRpc(DAILY_PLAY_RPC.CORRECT_SCORE, {
        ...scopeArgs(scope),
        p_match_id: String(matchId),
        p_score_a: Number(scoreA),
        p_score_b: Number(scoreB),
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey || newIdempotencyKey("correct-score"),
        p_note: note == null ? "" : String(note),
      });
    },

    async cancelMatch(scope, { matchId, expectedVersion, idempotencyKey }) {
      return callRpc(DAILY_PLAY_RPC.CANCEL_MATCH, {
        ...scopeArgs(scope),
        p_match_id: String(matchId),
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey || newIdempotencyKey("cancel"),
      });
    },

    async changeCourt(scope, { matchId, courtId, expectedVersion, idempotencyKey }) {
      return callRpc(DAILY_PLAY_RPC.CHANGE_COURT, {
        ...scopeArgs(scope),
        p_match_id: String(matchId),
        p_court_id: String(courtId),
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey || newIdempotencyKey("change-court"),
      });
    },

    resolveCreateMatchCount,
  };
}

let defaultService = null;
let testServiceOverride = null;

export function getDailyPlayCanonicalService() {
  if (testServiceOverride) return testServiceOverride;
  if (!defaultService) {
    defaultService = createDailyPlayCanonicalService();
  }
  return defaultService;
}

/** @internal */
export function __setDailyPlayCanonicalServiceForTests(service) {
  testServiceOverride = service || null;
}

/** @internal */
export function __resetDailyPlayCanonicalServiceForTests() {
  testServiceOverride = null;
  defaultService = null;
}
