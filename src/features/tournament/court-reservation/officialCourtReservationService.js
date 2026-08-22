/**
 * Official court reservation RPC adapter. Fail-closed. No club blob write.
 */

import { canonicalRowToTournament } from "../mappers/canonicalTournamentMapper.js";
import {
  OFFICIAL_COURT_CODE,
  OFFICIAL_COURT_MESSAGES,
  OFFICIAL_COURT_RPC,
} from "./officialCourtReservationCodes.js";

let rpcOverride = null;

export function __setOfficialCourtReservationRpcForTests(rpc) {
  rpcOverride = typeof rpc === "function" ? rpc : null;
}

export function __resetOfficialCourtReservationRpcForTests() {
  rpcOverride = null;
}

function newIdempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePayload(data) {
  if (data && typeof data === "object" && data.ok === false) {
    return {
      ...data,
      error: data.error || OFFICIAL_COURT_MESSAGES[data.code] || data.code,
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
      error: data.error || OFFICIAL_COURT_MESSAGES[data.code] || data.code,
    };
  }
  return { ok: true, data };
}

export function createOfficialCourtReservationService(deps = {}) {
  async function callRpc(name, args) {
    const injected = deps.rpc || rpcOverride;
    if (typeof injected === "function") {
      try {
        return normalizePayload(await injected(name, args));
      } catch (error) {
        return {
          ok: false,
          code: OFFICIAL_COURT_CODE.CLOUD_UNAVAILABLE,
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
          code: OFFICIAL_COURT_CODE.CLOUD_UNAVAILABLE,
          error: OFFICIAL_COURT_MESSAGES[OFFICIAL_COURT_CODE.CLOUD_UNAVAILABLE],
        };
      }
      const client = getSupabaseAuthClient();
      if (!client?.rpc) {
        return {
          ok: false,
          code: OFFICIAL_COURT_CODE.CLOUD_UNAVAILABLE,
          error: OFFICIAL_COURT_MESSAGES[OFFICIAL_COURT_CODE.CLOUD_UNAVAILABLE],
        };
      }
      const { data, error } = await client.rpc(name, args);
      if (error) {
        return {
          ok: false,
          code: OFFICIAL_COURT_CODE.CLOUD_UNAVAILABLE,
          error: String(error.message || error),
        };
      }
      return normalizePayload(data);
    } catch (error) {
      return {
        ok: false,
        code: OFFICIAL_COURT_CODE.CLOUD_UNAVAILABLE,
        error: String(error?.message || error),
      };
    }
  }

  return {
    async reserveCourts(input = {}) {
      return callRpc(OFFICIAL_COURT_RPC.RESERVE_COURTS, {
        p_tenant_id: input.tenantId,
        p_club_id: input.clubId,
        p_tournament_id: input.tournamentId,
        p_court_ids: input.courtIds || [],
        p_date: input.date,
        p_start_time: input.startTime,
        p_end_time: input.endTime,
        p_timezone: input.timezone,
        p_expected_version: Number(input.expectedVersion),
        p_idempotency_key: input.idempotencyKey || newIdempotencyKey("reserve"),
      });
    },
    async commitGroupSchedule(input = {}) {
      return callRpc(OFFICIAL_COURT_RPC.COMMIT_GROUP_SCHEDULE, {
        p_tenant_id: input.tenantId,
        p_club_id: input.clubId,
        p_tournament_id: input.tournamentId,
        p_event_id: input.eventId || null,
        p_matches: input.matches || [],
        p_expected_version: Number(input.expectedVersion),
        p_idempotency_key: input.idempotencyKey || newIdempotencyKey("group-schedule"),
      });
    },
  };
}
