import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../../context/SeasonContext.jsx";
import ClubAssignmentBanner from "../../../components/auth/ClubAssignmentBanner.jsx";
import PlatformContextReadinessGate from "../../../components/shell/PlatformContextReadinessGate.jsx";
import TournamentListTable from "../../../components/tournament/TournamentListTable.jsx";
import TournamentPageHeader from "../../../components/tournament/TournamentPageHeader.jsx";
import { usePageRuntimeAccess } from "../../../core/platform/app/usePageRuntimeAccess.js";
import { usePlatformContextReadiness } from "../../../core/platform/app/usePlatformContextReadiness.js";
import { isPlatformContextReady } from "../../../core/platform/app/platformContextReadiness.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/index.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/index.js";
import { getTeamData } from "../../team-tournament/engines/teamTournamentEngine.js";
import { findTeamForCaptain } from "../../team-tournament/engines/teamPermissionEngine.js";
import { useCanonicalCaptainAthleteId } from "../../team-tournament/ui/useCanonicalCaptainAthleteId.js";
import { buildCaptainPortalPath } from "../../../components/tournament/team/copyPortalLink.js";
import { useCanonicalTournamentList } from "../hooks/useCanonicalTournament.js";

function canDeleteTournament(tournament) {
  return (
    tournament.status === TOURNAMENT_STATUS.DRAFT ||
    tournament.status === TOURNAMENT_STATUS.CANCELLED
  );
}

export default function CanonicalTournamentListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const captainIdentity = useCanonicalCaptainAthleteId(user);
  const { activeClub, activeClubId, revision, refreshClubs } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();
  const contextReadiness = usePlatformContextReadiness({ requireClub: true });
  const contextReady = isPlatformContextReady(contextReadiness.state);
  const { accessAllowed } = usePageRuntimeAccess(
    "tournament.manage",
    activeClub?.tenantId || activeClubId,
    { source: "tournament.canonical.list" }
  );
  // Only load tournaments when platform context is ready — missing club must not
  // collapse into a legitimate empty list ("0 giải").
  const { tournaments, loading, error: loadError, remove } = useCanonicalTournamentList(
    contextReady ? activeClub : null,
    revision
  );
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const contextLine = [
    activeClub?.name ? `CLB ${activeClub.name}` : null,
    activeSeason?.name || null,
    activeLeague?.name || null,
  ]
    .filter(Boolean)
    .join(" • ");

  const deletableSelectedCount = tournaments.filter(
    (tournament) => selectedIds.includes(tournament.id) && canDeleteTournament(tournament)
  ).length;

  const isCaptainForTeamTournament = (tournament) => {
    const playerId = captainIdentity.athleteId;
    if (!playerId || tournament?.mode !== TOURNAMENT_MODE.TEAM_TOURNAMENT) {
      return false;
    }
    const teamData = getTeamData(tournament);
    return Boolean(findTeamForCaptain(teamData, playerId));
  };

  const handleConfirmDelete = async () => {
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác quản lý giải đấu.");
      return;
    }
    setError(null);
    setMessage(null);
    let deletedCount = 0;
    const blocked = [];
    for (const tournamentId of selectedIds) {
      const tournament = tournaments.find((item) => item.id === tournamentId);
      if (!tournament) continue;
      const result = await remove(tournamentId);
      if (result.ok) deletedCount += 1;
      else blocked.push(tournament.name);
    }
    refreshClubs();
    setSelectedIds([]);
    setDeleteDialogOpen(false);
    if (deletedCount > 0) setMessage(`Đã xóa ${deletedCount} giải.`);
    if (blocked.length > 0) {
      setError(`Không thể xóa ${blocked.length} giải (chỉ xóa được giải Nháp hoặc Đã hủy).`);
    }
  };

  return (
    <Box>
      <TournamentPageHeader
        title="Danh sách giải"
        description="Xem và quản lý tất cả giải từ canonical cloud (cùng nguồn đọc với Giải của tôi)."
        contextLine={contextLine || undefined}
      />
      <ClubAssignmentBanner />

      <PlatformContextReadinessGate requireClub showClubSwitcher>
        {loading ? <Alert severity="info" sx={{ mb: 2 }}>Đang tải danh sách giải...</Alert> : null}
        {loadError ? <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert> : null}
        {message ? (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        <TournamentListTable
          tournaments={tournaments}
          selectedIds={selectedIds}
          onToggleSelection={(tournamentId, checked) =>
            setSelectedIds((prev) =>
              checked ? [...prev, tournamentId] : prev.filter((id) => id !== tournamentId)
            )
          }
          onSelectAll={() => setSelectedIds(tournaments.map((item) => item.id))}
          onClearSelection={() => setSelectedIds([])}
          onDeleteSelected={() => setDeleteDialogOpen(true)}
          canDeleteTournament={canDeleteTournament}
          showCaptainPortal={isCaptainForTeamTournament}
          onCaptainPortal={(tournament) =>
            navigate(
              buildCaptainPortalPath(tournament.id, {
                clubId: tournament.clubId || activeClubId || null,
              })
            )
          }
        />
      </PlatformContextReadinessGate>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Xác nhận xóa giải</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn đã chọn <strong>{selectedIds.length}</strong> giải. Có thể xóa:{" "}
            <strong>{deletableSelectedCount}</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Hủy</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deletableSelectedCount === 0}
            onClick={handleConfirmDelete}
          >
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
