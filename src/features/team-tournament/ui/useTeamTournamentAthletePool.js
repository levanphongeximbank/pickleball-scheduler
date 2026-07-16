/**
 * React hook — single Team Tournament athlete pool entry for UI screens.
 */

import { useEffect, useMemo, useState } from "react";
import {
  listAvailableAthletes,
  resolveTeamTournamentAthleteClubId,
  resolveTeamTournamentAthleteTenantId,
  TEAM_TOURNAMENT_ATHLETE_SCOPE,
} from "../services/teamTournamentAthletePoolService.js";

/**
 * @param {{
 *   tournament?: object|null,
 *   clubFromQuery?: string|null,
 *   selectedClubId?: string|null,
 *   activeClubId?: string|null,
 *   clubs?: object[],
 *   currentTenantId?: string|null,
 *   scopeMode?: 'club'|'tenant',
 *   gender?: string|null,
 *   assignedAthleteIds?: string[],
 *   callerName?: string,
 *   revision?: number|string,
 *   enabled?: boolean,
 * }} options
 */
export function useTeamTournamentAthletePool(options = {}) {
  const {
    tournament = null,
    clubFromQuery = null,
    selectedClubId = null,
    activeClubId = null,
    clubs = [],
    currentTenantId = null,
    scopeMode = TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
    gender = "all",
    assignedAthleteIds = [],
    callerName = "useTeamTournamentAthletePool",
    revision = 0,
    enabled = true,
  } = options;

  const clubId = useMemo(
    () =>
      resolveTeamTournamentAthleteClubId({
        tournamentClubId: tournament?.clubId,
        clubFromQuery,
        selectedClubId,
        activeClubId,
      }),
    [tournament?.clubId, clubFromQuery, selectedClubId, activeClubId]
  );

  const hostClub = useMemo(
    () => clubs.find((c) => String(c?.id || "").trim() === clubId) || null,
    [clubs, clubId]
  );

  const tenantId = useMemo(
    () =>
      resolveTeamTournamentAthleteTenantId({
        tournament,
        club: hostClub,
        clubId,
        clubs,
        currentTenantId,
      }),
    [tournament, hostClub, clubId, clubs, currentTenantId]
  );

  const assignedKey = useMemo(
    () =>
      (assignedAthleteIds || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
        .sort()
        .join("|"),
    [assignedAthleteIds]
  );

  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [emptyMessage, setEmptyMessage] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setAthletes([]);
      setLoading(false);
      setError(null);
      setEmptyMessage(null);
      setDiagnostics(null);
      return undefined;
    }

    setLoading(true);
    setError(null);
    setEmptyMessage(null);

    listAvailableAthletes({
      tournamentId: tournament?.id || null,
      clubId,
      tenantId,
      scopeMode,
      gender,
      assignedAthleteIds: assignedKey ? assignedKey.split("|") : [],
      callerName,
    }).then((result) => {
      if (cancelled) return;
      setDiagnostics(result.diagnostics || null);
      if (!result.ok) {
        setAthletes([]);
        setError({
          code: result.code || "REPOSITORY_ERROR",
          message: result.message || "Không tải được VĐV.",
        });
        setEmptyMessage(null);
        setLoading(false);
        return;
      }
      setAthletes(Array.isArray(result.athletes) ? result.athletes : []);
      setError(null);
      setEmptyMessage(result.empty ? result.emptyMessage || result.message || null : null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    tournament?.id,
    clubId,
    tenantId,
    scopeMode,
    gender,
    assignedKey,
    callerName,
    revision,
  ]);

  return {
    athletes,
    players: athletes,
    loading,
    error,
    emptyMessage,
    diagnostics,
    clubId,
    tenantId,
    scopeMode,
    source: "team-tournament-athlete-pool",
  };
}
