import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  Alert,
  Box,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  useCanonicalTournament,
  useCanonicalTournamentList,
} from "../../features/tournament/hooks/useCanonicalTournament.js";
import { isIndividualTournament } from "../../config/tournamentRoutes.js";
import TournamentConfigPageShell from "../../components/tournament/TournamentConfigPageShell.jsx";
import IndividualTournamentSelector from "../../components/tournament/IndividualTournamentSelector.jsx";
import RefereeAssignPanel from "../../components/tournament/RefereeAssignPanel.jsx";
import MatchResultMonitorPanel from "../../components/tournament/MatchResultMonitorPanel.jsx";
import ResultCorrectionPanel from "../../components/tournament/ResultCorrectionPanel.jsx";
import IndividualRefereePortalPanel from "../../components/tournament/IndividualRefereePortalPanel.jsx";
import PlayerLiveResultsPanel from "../../components/tournament/PlayerLiveResultsPanel.jsx";

const TABS = [
  { id: "assign", label: "Phân công TT" },
  { id: "results", label: "Giám sát kết quả" },
  { id: "correction", label: "Sửa kết quả" },
  { id: "referee", label: "Cổng trọng tài" },
  { id: "player", label: "Kết quả VĐV" },
];

export default function TournamentRefereeAssignPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tournamentId = searchParams.get("tournamentId") || "";
  const tabParam = searchParams.get("tab") || "assign";
  const { activeClubId, revision, refreshClubs } = useClub();
  const { user } = useAuth();
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState(
    TABS.some((t) => t.id === tabParam) ? tabParam : "assign"
  );

  const { tournaments: allTournaments } = useCanonicalTournamentList(activeClubId, revision);
  const { tournament, update } = useCanonicalTournament(activeClubId, tournamentId, revision);

  const tournaments = useMemo(
    () => allTournaments.filter(isIndividualTournament),
    [allTournaments]
  );

  const persistTournament = async (nextTournament) => {
    if (!activeClubId || !tournamentId || !nextTournament) return false;
    const result = await update({
      settings: nextTournament.settings,
      events: nextTournament.events,
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

  const handleTab = (_event, value) => {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next);
  };

  return (
    <TournamentConfigPageShell
      title="Trọng tài & kết quả (Individual)"
      description="Phân công trọng tài, xác nhận kết quả, lan truyền bảng xếp hạng / nhánh, và sửa lỗi có kiểm soát."
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
        <Alert severity="info">
          Chọn giải cá nhân (không dùng dữ liệu demo đồng đội).
        </Alert>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={handleTab}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2 }}
          >
            {TABS.map((item) => (
              <Tab key={item.id} value={item.id} label={item.label} />
            ))}
          </Tabs>

          <Box>
            {tab === "assign" ? (
              <RefereeAssignPanel
                tournament={tournament}
                actor={user}
                onTournamentChange={persistTournament}
              />
            ) : null}
            {tab === "results" ? (
              <MatchResultMonitorPanel
                tournament={tournament}
                actor={user}
                onTournamentChange={persistTournament}
              />
            ) : null}
            {tab === "correction" ? (
              <ResultCorrectionPanel
                tournament={tournament}
                actor={user}
                onTournamentChange={persistTournament}
              />
            ) : null}
            {tab === "referee" ? (
              <IndividualRefereePortalPanel
                tournament={tournament}
                actor={user}
                onTournamentChange={persistTournament}
              />
            ) : null}
            {tab === "player" ? (
              <PlayerLiveResultsPanel tournament={tournament} />
            ) : null}
          </Box>

          {tournament ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
              Audit blob: settings.resultPropagation.auditLog · Phân công:
              settings.refereeAssignments · Kết quả: settings.matchResults
            </Typography>
          ) : null}
        </>
      )}
    </TournamentConfigPageShell>
  );
}
