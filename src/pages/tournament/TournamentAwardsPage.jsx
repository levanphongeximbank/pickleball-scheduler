import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Alert, Box, Tab, Tabs, Typography } from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  getTournament,
  listTournaments,
  updateTournament,
} from "../../domain/tournamentService.js";
import { isIndividualTournament } from "../../config/tournamentRoutes.js";
import TournamentConfigPageShell from "../../components/tournament/TournamentConfigPageShell.jsx";
import IndividualTournamentSelector from "../../components/tournament/IndividualTournamentSelector.jsx";
import WalkoverManagementPanel from "../../components/tournament/WalkoverManagementPanel.jsx";
import WithdrawalManagementPanel from "../../components/tournament/WithdrawalManagementPanel.jsx";
import ThirdPlaceSettingsPanel from "../../components/tournament/ThirdPlaceSettingsPanel.jsx";
import AwardManagerPanel from "../../components/tournament/AwardManagerPanel.jsx";
import CloseTournamentPanel from "../../components/tournament/CloseTournamentPanel.jsx";
import PlayerFinalResultsPanel from "../../components/tournament/PlayerFinalResultsPanel.jsx";

const TABS = [
  { id: "walkover", label: "Walkover" },
  { id: "withdrawal", label: "Rút lui" },
  { id: "third", label: "Hạng 3" },
  { id: "awards", label: "Trao giải" },
  { id: "close", label: "Đóng giải" },
  { id: "player", label: "Kết quả VĐV" },
];

export default function TournamentAwardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournamentId") || "";
  const tabParam = searchParams.get("tab") || "awards";
  const { activeClubId, revision, refreshClubs } = useClub();
  const { user } = useAuth();
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState(
    TABS.some((t) => t.id === tabParam) ? tabParam : "awards"
  );

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

  const handleSelect = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("tournamentId", id);
    else next.delete("tournamentId");
    setSearchParams(next);
  };

  const handleTab = (_e, value) => {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next);
  };

  return (
    <TournamentConfigPageShell
      title="Kết quả & trao giải (Individual)"
      description="Walkover, rút lui, tranh hạng ba, trao giải, đóng giải — giải cá nhân."
      noCard
    >
      <IndividualTournamentSelector
        tournaments={tournaments}
        tournamentId={tournamentId}
        onSelect={handleSelect}
      />

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      {!tournamentId ? (
        <Alert severity="info">Chọn giải cá nhân (không dùng dữ liệu demo đồng đội).</Alert>
      ) : (
        <>
          <Tabs value={tab} onChange={handleTab} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
            {TABS.map((item) => (
              <Tab key={item.id} value={item.id} label={item.label} />
            ))}
          </Tabs>
          <Box>
            {tab === "walkover" ? (
              <WalkoverManagementPanel
                tournament={tournament}
                actor={user}
                onTournamentChange={persistTournament}
              />
            ) : null}
            {tab === "withdrawal" ? (
              <WithdrawalManagementPanel
                tournament={tournament}
                actor={user}
                onTournamentChange={persistTournament}
              />
            ) : null}
            {tab === "third" ? (
              <ThirdPlaceSettingsPanel
                tournament={tournament}
                actor={user}
                onTournamentChange={persistTournament}
              />
            ) : null}
            {tab === "awards" ? (
              <AwardManagerPanel
                tournament={tournament}
                actor={user}
                onTournamentChange={persistTournament}
              />
            ) : null}
            {tab === "close" ? (
              <CloseTournamentPanel
                tournament={tournament}
                actor={user}
                onTournamentChange={persistTournament}
              />
            ) : null}
            {tab === "player" ? (
              <PlayerFinalResultsPanel tournament={tournament} />
            ) : null}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            Audit: settings.resultsOps.auditLog · Awards: settings.awards · Withdrawals:
            settings.withdrawals
          </Typography>
        </>
      )}
    </TournamentConfigPageShell>
  );
}
