import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useClub } from "../../../context/ClubContext.jsx";
import { getTournament, updateTournament, listTournaments } from "../../../domain/tournamentService.js";
import { isIndividualTournament } from "../../../config/tournamentRoutes.js";

/**
 * Load/persist individual tournament settings for config pages (S1-C).
 */
export function useIndividualTournamentConfig() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournamentId") || "";
  const { activeClubId, revision, refreshClubs } = useClub();
  const [message, setMessage] = useState(null);

  const tournaments = useMemo(
    () => listTournaments(activeClubId).filter(isIndividualTournament),
    [activeClubId, revision]
  );

  const tournament = useMemo(() => {
    if (!tournamentId || !activeClubId) return null;
    return getTournament(activeClubId, tournamentId);
  }, [activeClubId, tournamentId, revision]);

  const selectTournament = useCallback(
    (id) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set("tournamentId", id);
      else next.delete("tournamentId");
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const persistTournament = useCallback(
    (nextTournament) => {
      if (!tournamentId || !activeClubId) {
        setMessage({ type: "error", text: "Chưa chọn giải cá nhân." });
        return false;
      }
      const result = updateTournament(activeClubId, tournamentId, {
        settings: nextTournament.settings,
        events: nextTournament.events,
        status: nextTournament.status,
      });
      if (!result.ok) {
        setMessage({ type: "error", text: result.error || "Không lưu được." });
        return false;
      }
      refreshClubs();
      return true;
    },
    [activeClubId, tournamentId, refreshClubs]
  );

  return {
    tournamentId,
    tournament,
    tournaments,
    selectTournament,
    persistTournament,
    message,
    setMessage,
    activeClubId,
    revision,
  };
}
