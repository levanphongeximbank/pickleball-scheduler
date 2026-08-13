import { useEffect, useMemo, useState } from "react";

import { rpcTeamTournamentGetDashboard } from "../services/teamTournamentRpcService.js";
import {
  composeDashboardViewFromRpc,
  loadTeamTournamentDashboardSource,
} from "./loadTeamTournamentDashboard.js";

/**
 * Dashboard hook — server RPC is sole visibility authority.
 * clubId is projection-only (captain task hrefs). Local tenantId / activeClub
 * must never re-authorize or re-deny an ok=true get_dashboard payload.
 */
export function useTeamTournamentDashboard({
  tournamentId,
  clubId,
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
  }, [tournamentId]);

  const view = useMemo(() => {
    if (!source?.view) return null;
    return composeDashboardViewFromRpc({
      view: source.view,
      playerId,
      userId,
      canOrganize,
      isAuthenticated,
      clubId,
    });
  }, [source, playerId, userId, canOrganize, isAuthenticated, clubId]);

  return { loading, error, view, sourceKind: source?.ok ? "dashboard_rpc" : null };
}
