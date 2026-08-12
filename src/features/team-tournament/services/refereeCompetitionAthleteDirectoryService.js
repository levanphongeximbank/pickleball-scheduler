/**
 * Referee competition-scoped athlete directory.
 *
 * The referee portal must never enumerate club members to resolve athlete
 * identity (club_list_members is BTC-scoped and yields
 * "Không có quyền xem thành viên" for referee accounts). This reader is keyed
 * by tournament id only; when the RPC is not deployed the caller falls back to
 * rosterAthletes already embedded in the canonical setup payload.
 */

import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { normalizeRefereeCompetitionAthletes } from "../engines/refereeCompetitionAthleteProjection.js";

export const REFEREE_COMPETITION_ATHLETE_DIRECTORY_RPC =
  "team_tournament_referee_competition_athlete_directory";

export const REFEREE_DIRECTORY_CODES = Object.freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  RPC_NOT_DEPLOYED: "REFEREE_DIRECTORY_RPC_NOT_DEPLOYED",
  RPC_ERROR: "RPC_ERROR",
  EMPTY_RESPONSE: "EMPTY_RESPONSE",
});

/**
 * PostgREST surfaces an undeployed function as PGRST202 / SQLSTATE 42883.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isRefereeDirectoryRpcMissing(error) {
  if (!error) {
    return false;
  }
  const code = String(error.code || "").trim().toUpperCase();
  if (code === "PGRST202" || code === "42883" || code === "404") {
    return true;
  }
  const message = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`;
  return /could not find the function|function .* does not exist|schema cache/i.test(
    message
  );
}

/**
 * @param {{ tournamentId?: string }} params
 * @param {{ client?: object }} [deps]
 * @returns {Promise<{
 *   ok: boolean,
 *   athletes: object[],
 *   code?: string,
 *   error?: string,
 *   missingRpc?: boolean,
 * }>}
 */
export async function getRefereeCompetitionAthleteDirectory(params = {}, deps = {}) {
  const tournamentId = String(params.tournamentId || "").trim();
  if (!tournamentId) {
    return {
      ok: false,
      athletes: [],
      code: REFEREE_DIRECTORY_CODES.VALIDATION_ERROR,
      error: "Thiếu tournamentId.",
    };
  }

  const client = deps.client || getSupabaseAuthClient();
  if (!client?.rpc) {
    return {
      ok: false,
      athletes: [],
      code: REFEREE_DIRECTORY_CODES.NOT_CONFIGURED,
      error: "Supabase chưa sẵn sàng.",
    };
  }

  let response;
  try {
    response = await client.rpc(REFEREE_COMPETITION_ATHLETE_DIRECTORY_RPC, {
      p_tournament_id: tournamentId,
    });
  } catch (error) {
    return {
      ok: false,
      athletes: [],
      code: isRefereeDirectoryRpcMissing(error)
        ? REFEREE_DIRECTORY_CODES.RPC_NOT_DEPLOYED
        : REFEREE_DIRECTORY_CODES.RPC_ERROR,
      error: error?.message || "Không tải được danh sách VĐV của giải.",
      missingRpc: isRefereeDirectoryRpcMissing(error),
    };
  }

  const { data, error } = response || {};

  if (error) {
    const missingRpc = isRefereeDirectoryRpcMissing(error);
    return {
      ok: false,
      athletes: [],
      code: missingRpc
        ? REFEREE_DIRECTORY_CODES.RPC_NOT_DEPLOYED
        : REFEREE_DIRECTORY_CODES.RPC_ERROR,
      error: error.message || "Không tải được danh sách VĐV của giải.",
      missingRpc,
    };
  }

  if (!data || typeof data !== "object") {
    return {
      ok: false,
      athletes: [],
      code: REFEREE_DIRECTORY_CODES.EMPTY_RESPONSE,
      error: "RPC danh bạ VĐV trả về rỗng.",
    };
  }

  if (data.ok === false) {
    return {
      ok: false,
      athletes: [],
      code: data.code || REFEREE_DIRECTORY_CODES.RPC_ERROR,
      error: data.error || "Không tải được danh sách VĐV của giải.",
    };
  }

  return {
    ok: true,
    athletes: normalizeRefereeCompetitionAthletes(data.athletes),
  };
}
