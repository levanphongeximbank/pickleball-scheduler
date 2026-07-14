import { useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { Alert, Button, Stack } from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  getTournament,
  listTournaments,
  updateTournament,
} from "../../domain/tournamentService.js";
import { isIndividualTournament, TOURNAMENT_ROUTES } from "../../config/tournamentRoutes.js";
import TournamentConfigPageShell from "../../components/tournament/TournamentConfigPageShell.jsx";
import IndividualTournamentSelector from "../../components/tournament/IndividualTournamentSelector.jsx";
import WithdrawalManagementPanel from "../../components/tournament/WithdrawalManagementPanel.jsx";

/**
 * Dedicated withdrawal route — individual loader (no team demo).
 * Full results-ops hub also available at /tournament/awards?tab=withdrawal.
 */
export default function TournamentWithdrawalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournamentId") || "";
  const { activeClubId, revision, refreshClubs } = useClub();
  const { user } = useAuth();
  const [message, setMessage] = useState(null);

  const tournaments = useMemo(
    () => listTournaments(activeClubId).filter(isIndividualTournament),
    [activeClubId, revision]
  );

  const tournament = useMemo(() => {
    if (!tournamentId || !activeClubId) return null;
    return getTournament(activeClubId, tournamentId);
  }, [activeClubId, tournamentId, revision]);

  const persistTournament = (nextTournament) => {
    if (!activeClubId || !tournamentId || !nextTournament) return false;
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
  };

  return (
    <TournamentConfigPageShell
      title="Xử lý rút lui / bỏ cuộc"
      description="Rút lui trước/trong giải, chấn thương, thay thế — giải cá nhân."
      noCard
    >
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          component={RouterLink}
          to={`${TOURNAMENT_ROUTES.awards}?tournamentId=${encodeURIComponent(tournamentId)}&tab=withdrawal`}
          size="small"
        >
          Mở hub Kết quả & trao giải
        </Button>
      </Stack>

      <IndividualTournamentSelector
        tournaments={tournaments}
        tournamentId={tournamentId}
        onSelect={(id) => {
          const next = new URLSearchParams(searchParams);
          if (id) next.set("tournamentId", id);
          else next.delete("tournamentId");
          setSearchParams(next);
        }}
      />

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <WithdrawalManagementPanel
        tournament={tournament}
        actor={user}
        onTournamentChange={persistTournament}
      />
    </TournamentConfigPageShell>
  );
}
