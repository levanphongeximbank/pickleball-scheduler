import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useClub } from "../../../context/ClubContext.jsx";
import {
  useCanonicalTournament,
  useCanonicalTournamentList,
} from "../../tournament/hooks/useCanonicalTournament.js";
import { isIndividualTournament } from "../../../config/tournamentRoutes.js";

/**
 * Load/persist individual tournament settings for config pages (S1-C).
 */
export function useIndividualTournamentConfig() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournamentId") || "";
  const { activeClub, activeClubId, revision, refreshClubs } = useClub();
  const [message, setMessage] = useState(null);

  const { tournaments: allTournaments } = useCanonicalTournamentList(activeClub || { id: activeClubId }, revision);
  const { tournament, update } = useCanonicalTournament(activeClub || { id: activeClubId }, tournamentId, revision);

  const tournaments = useMemo(
    () => allTournaments.filter(isIndividualTournament),
    [allTournaments]
  );

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
    async (nextTournament) => {
      if (!tournamentId || !activeClubId) {
        setMessage({ type: "error", text: "Chưa chọn giải cá nhân." });
        return false;
      }
      const result = await update({
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
    [activeClubId, tournamentId, refreshClubs, update]
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
