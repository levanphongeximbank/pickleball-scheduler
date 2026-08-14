import { useEffect, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { rpcTeamTournamentListMyDashboards } from "../services/teamTournamentRpcService.js";
import { listTournamentsQuery } from "../../tournament/services/tournamentQueries.js";
import { aggregateMyTournamentDashboards } from "../../tournament/my-tournaments/aggregateMyTournamentDashboards.js";

/**
 * Loads Giải của tôi: Team list_my_dashboards + Internal assigned canonical projection.
 * Team RPC remains the Team authority. No client filter of Team rows.
 */
export function useMyTournamentDashboards({ enabled = true } = {}) {
  const { user } = useAuth();
  const { clubs, activeClub } = useClub();
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
      const aggregated = await aggregateMyTournamentDashboards({
        user,
        clubs,
        activeClub,
        listTeamDashboards: rpcTeamTournamentListMyDashboards,
        listCanonicalTournaments: listTournamentsQuery,
      });
      if (cancelled) return;
      if (!aggregated.ok) {
        setTournaments([]);
        setError(aggregated.error || aggregated.code);
      } else {
        setTournaments(aggregated.tournaments);
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
  }, [enabled, user, clubs, activeClub]);

  return { loading, error, tournaments };
}
