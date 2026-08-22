/**
 * Shared Team Experience setup model — wraps existing useTeamTournamentPage + access + athlete pools.
 * No second data authority.
 */
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { useAuth } from "../../../../context/AuthContext.jsx";
import { useClub } from "../../../../context/ClubContext.jsx";
import { useTenant } from "../../../../context/TenantContext.jsx";
import { useTeamTournamentPage } from "../../../team-tournament/ui/useTeamTournamentPage.js";
import { useTeamTournamentAthletePool } from "../../../team-tournament/ui/useTeamTournamentAthletePool.js";
import { TEAM_TOURNAMENT_ATHLETE_SCOPE } from "../../../team-tournament/services/teamTournamentAthletePoolService.js";
import { resolveTeamTournamentCloudPageAccess } from "../../../team-tournament/ui/teamTournamentCloudAccess.js";
import {
  projectTeamParticipants,
  projectTeamSchedule,
  projectTeamSettings,
} from "./projectTeamExperienceSurfaces.js";

function useTeamTournamentAccess({ tournament, activeClubId }) {
  const { rbacEnabled, isAuthenticated, can, user } = useAuth();
  const { currentTenantId } = useTenant();

  return useMemo(
    () =>
      resolveTeamTournamentCloudPageAccess({
        rbacEnabled,
        isAuthenticated,
        clubId: activeClubId,
        tournament,
        currentTenantId,
        user,
        can,
      }),
    [
      activeClubId,
      can,
      currentTenantId,
      isAuthenticated,
      rbacEnabled,
      tournament,
      user,
    ]
  );
}

export function useTeamExperienceSetup() {
  const { tournamentId } = useParams();
  const [searchParams] = useSearchParams();
  const { activeClubId, clubs } = useClub();
  const { currentTenantId } = useTenant();
  const { user } = useAuth();
  const clubFromQuery = String(searchParams.get("club") || "").trim();
  const loadClubId = clubFromQuery || activeClubId;

  const page = useTeamTournamentPage({
    clubId: loadClubId,
    tournamentId,
    pollingEnabled: true,
  });

  const effectiveClubId = String(
    page.tournament?.clubId || loadClubId || activeClubId || ""
  ).trim();

  const access = useTeamTournamentAccess({
    tournament: page.tournament,
    activeClubId: effectiveClubId || activeClubId,
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clubPool = useTeamTournamentAthletePool({
    tournament: page.tournament,
    clubFromQuery,
    activeClubId,
    clubs,
    currentTenantId,
    scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
    callerName: "TeamExperience.club",
    revision: page.rosterSetupRevision,
  });

  const tenantPool = useTeamTournamentAthletePool({
    tournament: page.tournament,
    clubFromQuery,
    activeClubId,
    clubs,
    currentTenantId,
    scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT,
    callerName: "TeamExperience.tenant",
    revision: page.rosterSetupRevision,
  });

  const teamData = useMemo(
    () =>
      page.teamData || {
        teams: [],
        disciplines: [],
        matchups: [],
        standings: [],
        groups: [],
        settings: {},
      },
    [page.teamData]
  );

  const players = useMemo(() => clubPool.players || [], [clubPool.players]);
  const allTenantPlayers = useMemo(
    () => tenantPool.players || [],
    [tenantPool.players]
  );

  const settingsProjection = useMemo(
    () => projectTeamSettings({ tournament: page.tournament, teamData }),
    [page.tournament, teamData]
  );
  const participantsProjection = useMemo(
    () =>
      projectTeamParticipants({
        tournament: page.tournament,
        teamData,
        players: [...players, ...allTenantPlayers],
      }),
    [page.tournament, teamData, players, allTenantPlayers]
  );
  const scheduleProjection = useMemo(
    () => projectTeamSchedule({ tournament: page.tournament, teamData }),
    [page.tournament, teamData]
  );

  const tenantId =
    page.tournament?.tenantId ||
    clubPool.tenantId ||
    tenantPool.tenantId ||
    currentTenantId;

  return {
    tournamentId,
    user,
    clubFromQuery,
    activeClubId,
    clubs,
    effectiveClubId: effectiveClubId || activeClubId,
    tenantId,
    access,
    loading: page.loading,
    loadError: page.error,
    tournament: page.tournament,
    teamData,
    version: page.version,
    reload: page.reload,
    refreshAfterMutation: page.refreshAfterMutation,
    beginMutationBarrier: page.beginMutationBarrier,
    endMutationBarrier: page.endMutationBarrier,
    persistSetupTeamData: page.persistSetupTeamData,
    persistFormatVenueSetup: page.persistFormatVenueSetup,
    rosterSetupRevision: page.rosterSetupRevision,
    players,
    allTenantPlayers,
    clubPool,
    tenantPool,
    settingsProjection,
    participantsProjection,
    scheduleProjection,
    message,
    setMessage,
    error,
    setError,
  };
}
