import { useEffect, useMemo, useState } from "react";

import { rpcTeamTournamentGetDashboard } from "../services/teamTournamentRpcService.js";
import {
  composeDashboardViewFromRpc,
  loadTeamTournamentDashboardSource,
} from "./loadTeamTournamentDashboard.js";

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
      const dashboard = await loadTeamTournamentDashboardSource({
        getDashboard: rpcTeamTournamentGetDashboard,
        tournamentId,
      });
      if (cancelled) return;
      if (!dashboard.ok) {
        setSource(null);
        setError(dashboard.error || dashboard.code);
        setLoading(false);
        return;
      }
      setSource(dashboard);
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
    if (!source?.view) return null;
    const sameTenant =
      Boolean(tenantId) &&
      String(source.view.overview?.tenantId || tenantId) === String(tenantId);
    return composeDashboardViewFromRpc({
      view: source.view,
      playerId,
      userId,
      canOrganize,
      sameTenant,
      isAuthenticated,
      clubId,
    });
  }, [source, playerId, userId, canOrganize, tenantId, isAuthenticated, clubId]);

  return { loading, error, view, sourceKind: source?.ok ? "dashboard_rpc" : null };
}
