import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

let testRpcClientOverride = null;

export function __setTeamTournamentRpcClientForTests(client) {
  testRpcClientOverride = client;
}

export function __resetTeamTournamentRpcClientForTests() {
  testRpcClientOverride = null;
}

function resolveRpcClient() {
  return testRpcClientOverride || getSupabaseAuthClient();
}

function parseRpcJson(data) {
  if (!data) {
    return { ok: false, code: "EMPTY_RESPONSE", error: "RPC trả về rỗng." };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, ...data };
}

export function isTeamTournamentRpcNotFoundError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist")) ||
    error?.code === "PGRST202"
  );
}

async function callTeamTournamentRpc(rpcName, args = {}) {
  const client = resolveRpcClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc(rpcName, args);

  if (error) {
    if (isTeamTournamentRpcNotFoundError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  const payload = parseRpcJson(data);
  if (!payload.ok) {
    const code = payload.code || "FORBIDDEN";
    const passthrough = [
      "version_conflict",
      "lineup_locked",
      "deadline_passed",
      "player_not_in_team",
      "player_inactive",
      "player_not_eligible",
      "invalid_gender",
      "invalid_discipline",
      "duplicate_player",
      "duplicate_slot",
      "roster_limit_exceeded",
      "lineup_incomplete",
      "captain_scope_denied",
      "cross_tenant_denied",
      "NOT_FOUND",
      "FORBIDDEN",
      "NOT_AUTHENTICATED",
      "VALIDATION",
      "LOCKED",
    ];
    if (passthrough.includes(code)) {
      return { ...payload, provider: "rpc" };
    }
    const errorByCode = {
      NOT_FOUND: "Giải chưa có trên cloud. Kiểm tra venue ở header rồi thử lại.",
      FORBIDDEN: "Không có quyền quản lý giải đồng đội.",
      NOT_AUTHENTICATED: "Phiên đăng nhập hết hạn — đăng nhập lại.",
      VALIDATION: payload.error || "Dữ liệu đội không hợp lệ.",
    };
    return {
      ok: false,
      code,
      error: payload.error || payload.message || errorByCode[code] || "Không có quyền.",
      ...payload,
      provider: "rpc",
    };
  }

  return { ...payload, provider: "rpc" };
}

export async function rpcTeamTournamentGetSetup(tournamentId, viewerTeamId = null) {
  return callTeamTournamentRpc("team_tournament_get_setup", {
    p_tournament_id: String(tournamentId),
    p_viewer_team_id: viewerTeamId ? String(viewerTeamId) : null,
  });
}

export async function rpcTeamTournamentSaveTeam(tournamentId, team) {
  return callTeamTournamentRpc("team_tournament_save_team", {
    p_tournament_id: String(tournamentId),
    p_team: team,
  });
}

export async function rpcTeamTournamentAssignMember(tournamentId, teamId, playerId) {
  return callTeamTournamentRpc("team_tournament_assign_member", {
    p_tournament_id: String(tournamentId),
    p_team_id: String(teamId),
    p_player_id: String(playerId),
  });
}

export async function rpcTeamTournamentRemoveMember(tournamentId, teamId, playerId) {
  return callTeamTournamentRpc("team_tournament_remove_member", {
    p_tournament_id: String(tournamentId),
    p_team_id: String(teamId),
    p_player_id: String(playerId),
  });
}

export async function rpcTeamTournamentSetCaptain(
  tournamentId,
  teamId,
  playerId,
  deputyIds = []
) {
  return callTeamTournamentRpc("team_tournament_set_captain", {
    p_tournament_id: String(tournamentId),
    p_team_id: String(teamId),
    p_player_id: String(playerId),
    p_deputy_ids: deputyIds,
  });
}

export async function rpcTeamTournamentSaveLineupDraft(
  tournamentId,
  matchupId,
  teamId,
  selections
) {
  return callTeamTournamentRpc("team_tournament_save_lineup_draft", {
    p_tournament_id: String(tournamentId),
    p_matchup_id: String(matchupId),
    p_team_id: String(teamId),
    p_selections: selections,
  });
}

export async function rpcTeamTournamentSubmitLineup(
  tournamentId,
  matchupId,
  teamId,
  selections
) {
  return callTeamTournamentRpc("team_tournament_submit_lineup", {
    p_tournament_id: String(tournamentId),
    p_matchup_id: String(matchupId),
    p_team_id: String(teamId),
    p_selections: selections,
  });
}

export async function rpcTeamTournamentLockMatchup(tournamentId, matchupId) {
  return callTeamTournamentRpc("team_tournament_lock_matchup", {
    p_tournament_id: String(tournamentId),
    p_matchup_id: String(matchupId),
  });
}

export async function rpcTeamTournamentPublishMatchup(tournamentId, matchupId) {
  return callTeamTournamentRpc("team_tournament_publish_matchup", {
    p_tournament_id: String(tournamentId),
    p_matchup_id: String(matchupId),
  });
}

export async function rpcTeamTournamentSaveSubMatchDraft(
  tournamentId,
  matchupId,
  subMatchId,
  score
) {
  return callTeamTournamentRpc("team_tournament_save_sub_match_draft", {
    p_tournament_id: String(tournamentId),
    p_matchup_id: String(matchupId),
    p_sub_match_id: String(subMatchId),
    p_score: score,
  });
}

export async function rpcTeamTournamentConfirmSubMatch(
  tournamentId,
  matchupId,
  subMatchId,
  score,
  winnerTeamId = null
) {
  return callTeamTournamentRpc("team_tournament_confirm_sub_match", {
    p_tournament_id: String(tournamentId),
    p_matchup_id: String(matchupId),
    p_sub_match_id: String(subMatchId),
    p_score: score,
    p_winner_team_id: winnerTeamId,
  });
}

export async function rpcTeamTournamentGetStandings(tournamentId) {
  return callTeamTournamentRpc("team_tournament_get_standings", {
    p_tournament_id: String(tournamentId),
  });
}

export async function rpcTeamTournamentUpsertStandings(tournamentId, standings) {
  return callTeamTournamentRpc("team_tournament_upsert_standings", {
    p_tournament_id: String(tournamentId),
    p_standings: standings,
  });
}
