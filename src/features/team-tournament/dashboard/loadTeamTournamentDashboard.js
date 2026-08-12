/**
 * Dashboard reader: team_tournament_get_dashboard only.
 * Missing RPC / failed get → FAIL CLOSED. No get_setup compose. No blob.
 */
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import { buildTeamTournamentDashboardView } from "./teamTournamentDashboardModel.js";

export function isLifecycleRpcMissing(code) {
  return ["RPC_MISSING", "rpc_not_deployed", "rpc_signature_mismatch"].includes(
    String(code || "")
  );
}

export async function loadTeamTournamentDashboardSource({
  getDashboard,
  tournamentId,
} = {}) {
  const id = String(tournamentId || "").trim();
  if (!id) {
    return { ok: false, code: "VALIDATION", error: "Thiếu mã giải." };
  }
  if (typeof getDashboard !== "function") {
    return {
      ok: false,
      code: "RPC_MISSING",
      error: "Chưa có RPC team_tournament_get_dashboard.",
    };
  }
  const result = await getDashboard(id);
  if (result?.ok && result.view) {
    return { ok: true, view: result.view };
  }
  const code = result?.code || "DASHBOARD_UNAVAILABLE";
  const visibilityDenied =
    code === "DRAFT_NOT_VISIBLE" ||
    code === "NOT_VISIBLE" ||
    code === "CROSS_TENANT_DENIED" ||
    code === "NOT_AUTHENTICATED";
  return {
    ok: false,
    code,
    error:
      result?.error ||
      (visibilityDenied
        ? code === "NOT_AUTHENTICATED"
          ? "Phiên đăng nhập hết hạn — đăng nhập lại."
          : code === "CROSS_TENANT_DENIED"
            ? "Không xem được giải của tenant khác."
            : "Bạn không có quyền xem bảng điều khiển giải này."
        : isLifecycleRpcMissing(code)
          ? "Bảng điều khiển giải chưa sẵn sàng trên máy chủ."
          : "Không tải được bảng điều khiển giải."),
  };
}

export function composeDashboardViewFromRpc({
  view,
  playerId = null,
  userId = null,
  canOrganize = false,
  sameTenant = false,
  isAuthenticated = false,
  clubId = null,
} = {}) {
  if (!view?.overview?.id) {
    return {
      ok: false,
      code: "DASHBOARD_UNAVAILABLE",
      error: "Máy chủ không trả về bảng điều khiển hợp lệ.",
    };
  }
  const tournament = {
    id: view.overview.id,
    name: view.overview.name,
    status: view.overview.status,
    clubId: view.overview.clubId,
    tenantId: view.overview.tenantId,
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    settings: { stageTieBreakPolicy: view.stageTieBreakPolicy || {} },
  };
  const teamData = {
    settings: {
      stageTieBreakPolicy: view.stageTieBreakPolicy || {},
      formatPreset: view.overview.formatPreset || null,
    },
    teams: view.teams || [],
    matchups: view.matchups || [],
    standings: view.standings || [],
  };
  return buildTeamTournamentDashboardView({
    tournament,
    teamData,
    playerId,
    userId,
    canOrganize: view.capabilities?.canOrganize === true || canOrganize === true,
    sameTenant,
    isAuthenticated,
    refereeAssignments: view.refereeAssignments || [],
    clubId,
    serverCapabilities: view.capabilities || null,
    myTeamRoster: view.myTeam?.roster || view.myTeam?.members || null,
  });
}
