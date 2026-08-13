import { useEffect, useState } from "react";

import { rpcTeamTournamentListMyDashboards } from "../services/teamTournamentRpcService.js";
import { normalizeMyDashboardListResult } from "./myDashboardsModel.js";

/**
 * Loads Giải của tôi from team_tournament_list_my_dashboards only.
 * No activeClub / tenant / playerId client authority.
 */
export function useMyTournamentDashboards({ enabled = true } = {}) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!enabled) {
        setLoading(false);
        setTournaments([]);
        return;
      }
      setLoading(true);
      setError(null);
      const raw = await rpcTeamTournamentListMyDashboards();
      if (cancelled) return;
      const normalized = normalizeMyDashboardListResult(raw);
      if (!normalized.ok) {
        setTournaments([]);
        setError(normalized.error || normalized.code);
      } else {
        setTournaments(normalized.tournaments);
        setError(null);
      }
      setLoading(false);
    }
    load().catch((err) => {
      if (!cancelled) {
        setError(String(err?.message || err));
        setTournaments([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { loading, error, tournaments };
}
