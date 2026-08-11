import { useEffect, useMemo, useState } from "react";

import { getTeamData } from "../engines/teamTournamentEngine.js";
import {
  rpcTeamTournamentGetDashboard,
  rpcTeamTournamentGetSetup,
  rpcTeamTournamentListMyRefereeAssignments,
} from "../services/teamTournamentRpcService.js";
import { buildTeamTournamentDashboardView } from "./teamTournamentDashboardModel.js";
import { isTeamTournamentMode } from "../lifecycle/teamTournamentLifecycle.js";

function mapSetupToTeamData(payload) {
  const tournament = payload?.tournament || payload;
  return getTeamData(tournament) || tournament?.teamData || {};
}

export function useTeamTournamentDashboard({
  tournamentId,
  clubId,
  tenantId,
  playerId,
  userId,
  canOrganize = false,
  isAuthenticated = false,
} = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!tournamentId) {
        setLoading(false);
        setError("Thiếu mã giải.");
        return;
      }
      setLoading(true);
      setError(null);
      const dashboardRpc = await rpcTeamTournamentGetDashboard(tournamentId);
      if (cancelled) return;
      if (dashboardRpc?.ok && dashboardRpc.view) {
        setSource({ kind: "dashboard_rpc", ...dashboardRpc });
        setLoading(false);
        return;
      }
      if (
        dashboardRpc?.code &&
        !["RPC_MISSING", "rpc_not_deployed", "rpc_signature_mismatch"].includes(
          dashboardRpc.code
        )
      ) {
        setSource(null);
        setError(dashboardRpc.error || dashboardRpc.code);
        setLoading(false);
        return;
      }

      const setup = await rpcTeamTournamentGetSetup(tournamentId, null, {
        schemaVersion: 7,
      });
      if (cancelled) return;
      if (!setup?.ok) {
        setSource(null);
        setError(setup?.error || setup?.code || "Không tải được giải.");
        setLoading(false);
        return;
      }
      const assignments = await rpcTeamTournamentListMyRefereeAssignments(tournamentId);
      if (cancelled) return;
      setSource({
        kind: "composed",
        tournament: setup.tournament,
        teamData: mapSetupToTeamData(setup),
        refereeAssignments: assignments?.ok ? assignments.assignments || [] : [],
      });
      setLoading(false);
    }
    load().catch((err) => {
      if (!cancelled) {
        setError(String(err?.message || err));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, clubId, tenantId]);

  const view = useMemo(() => {
    if (!source) return null;
    if (source.kind === "dashboard_rpc" && source.view) {
      return source.view;
    }
    const tournament = source.tournament;
    if (!isTeamTournamentMode(tournament)) {
      return {
        ok: false,
        code: "NOT_TEAM_TOURNAMENT",
        individualTournamentId: tournament?.id || tournamentId,
      };
    }
    return buildTeamTournamentDashboardView({
      tournament,
      teamData: source.teamData,
      playerId,
      userId,
      canOrganize,
      sameTenant: Boolean(tenantId) && String(tournament?.tenantId || tenantId) === String(tenantId),
      isAuthenticated,
      refereeAssignments: source.refereeAssignments || [],
      clubId,
    });
  }, [source, playerId, userId, canOrganize, tenantId, isAuthenticated, clubId, tournamentId]);

  return { loading, error, view, sourceKind: source?.kind || null };
}
