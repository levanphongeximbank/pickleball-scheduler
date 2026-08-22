import { useEffect, useState } from "react";

import { rpcTeamTournamentListMyDashboards } from "../services/teamTournamentRpcService.js";
import { listMyOfficialRefereeAssignmentsCommand } from "../../tournament/official-lifecycle/officialOpenLifecycleCommands.js";
import {
  normalizeMyDashboardListResult,
  normalizeOfficialRefereeAssignmentListResult,
} from "./myDashboardsModel.js";

/**
 * Shared Giải của tôi aggregation. Team and Official adapters remain
 * server-authorized; no activeClub / tenant / playerId client authority.
 */
export function useMyTournamentDashboards({ enabled = true } = {}) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!enabled) {
        setLoading(false);
        setWarning(null);
        setTournaments([]);
        return;
      }
      setLoading(true);
      setError(null);
      setWarning(null);
      const [teamResult, officialResult] = await Promise.allSettled([
        rpcTeamTournamentListMyDashboards(),
        listMyOfficialRefereeAssignmentsCommand(),
      ]);
      if (cancelled) return;

      const team = normalizeMyDashboardListResult(
        teamResult.status === "fulfilled"
          ? teamResult.value
          : { ok: false, error: String(teamResult.reason || "") }
      );
      const official = normalizeOfficialRefereeAssignmentListResult(
        officialResult.status === "fulfilled"
          ? officialResult.value
          : { ok: false, error: String(officialResult.reason || "") }
      );

      if (!team.ok && !official.ok) {
        setTournaments([]);
        setError([team.error, official.error].filter(Boolean).join(" "));
      } else {
        setTournaments([
          ...(team.ok ? team.tournaments : []),
          ...(official.ok ? official.tournaments : []),
        ]);
        setError(null);
        const sourceWarnings = [
          !team.ok ? team.error : null,
          !official.ok ? official.error : null,
        ].filter(Boolean);
        setWarning(sourceWarnings.join(" "));
      }
      setLoading(false);
    }
    load().catch((err) => {
      if (!cancelled) {
        setError(String(err?.message || err));
        setWarning(null);
        setTournaments([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { loading, error, warning, tournaments };
}
