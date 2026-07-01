import { createContext, useCallback, useContext, useMemo } from "react";

import { useClub } from "./ClubContext.jsx";
import { loadClubData } from "../domain/clubStorage.js";
import {
  createLeague,
  setActiveLeague,
  updateLeague,
} from "../domain/leagueService.js";
import {
  createSeason,
  setActiveSeason,
  updateSeason,
} from "../domain/seasonService.js";

const SeasonContext = createContext(null);

export function SeasonProvider({ children }) {
  const { activeClubId, revision, refreshClubs } = useClub();

  const clubData = useMemo(
    () => loadClubData(activeClubId),
    [activeClubId, revision]
  );

  const seasons = clubData.seasons || [];
  const leagues = clubData.leagues || [];
  const activeSeasonId = clubData?.active?.seasonId ?? null;
  const activeLeagueId = clubData?.active?.leagueId ?? null;

  const activeSeason = useMemo(
    () => seasons.find((season) => season.id === activeSeasonId) || seasons[0] || null,
    [seasons, activeSeasonId]
  );

  const activeLeague = useMemo(
    () => leagues.find((league) => league.id === activeLeagueId) || leagues[0] || null,
    [leagues, activeLeagueId]
  );

  const leaguesForActiveSeason = useMemo(
    () => leagues.filter((league) => league.seasonId === activeSeason?.id),
    [leagues, activeSeason]
  );

  const handleSetActiveSeason = useCallback(
    (seasonId) => {
      const result = setActiveSeason(activeClubId, seasonId);

      if (result.ok) {
        refreshClubs();
      }

      return result;
    },
    [activeClubId, refreshClubs]
  );

  const handleSetActiveLeague = useCallback(
    (leagueId) => {
      const result = setActiveLeague(activeClubId, leagueId);

      if (result.ok) {
        refreshClubs();
      }

      return result;
    },
    [activeClubId, refreshClubs]
  );

  const handleCreateSeason = useCallback(
    (name, options = {}) => {
      const result = createSeason(activeClubId, name, options);

      if (result.ok) {
        refreshClubs();
      }

      return result;
    },
    [activeClubId, refreshClubs]
  );

  const handleCreateLeague = useCallback(
    (seasonId, name, options = {}) => {
      const result = createLeague(activeClubId, seasonId, name, options);

      if (result.ok) {
        refreshClubs();
      }

      return result;
    },
    [activeClubId, refreshClubs]
  );

  const handleUpdateSeason = useCallback(
    (seasonId, patch) => {
      const result = updateSeason(activeClubId, seasonId, patch);

      if (result.ok) {
        refreshClubs();
      }

      return result;
    },
    [activeClubId, refreshClubs]
  );

  const handleUpdateLeague = useCallback(
    (leagueId, patch) => {
      const result = updateLeague(activeClubId, leagueId, patch);

      if (result.ok) {
        refreshClubs();
      }

      return result;
    },
    [activeClubId, refreshClubs]
  );

  const value = useMemo(
    () => ({
      seasons,
      leagues,
      leaguesForActiveSeason,
      activeSeason,
      activeLeague,
      activeSeasonId,
      activeLeagueId,
      setActiveSeason: handleSetActiveSeason,
      setActiveLeague: handleSetActiveLeague,
      createSeason: handleCreateSeason,
      createLeague: handleCreateLeague,
      updateSeason: handleUpdateSeason,
      updateLeague: handleUpdateLeague,
    }),
    [
      seasons,
      leagues,
      leaguesForActiveSeason,
      activeSeason,
      activeLeague,
      activeSeasonId,
      activeLeagueId,
      handleSetActiveSeason,
      handleSetActiveLeague,
      handleCreateSeason,
      handleCreateLeague,
      handleUpdateSeason,
      handleUpdateLeague,
    ]
  );

  return (
    <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
  );
}

export function useSeasonLeague() {
  const context = useContext(SeasonContext);

  if (!context) {
    throw new Error("useSeasonLeague must be used within SeasonProvider");
  }

  return context;
}

export function getSessionContextMeta(activeClubId, activeSeasonId, activeLeagueId) {
  return {
    clubId: activeClubId,
    seasonId: activeSeasonId,
    leagueId: activeLeagueId,
  };
}
