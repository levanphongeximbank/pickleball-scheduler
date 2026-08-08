import { useMemo, useState } from "react";
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
import TournamentListTable from "../../../components/tournament/TournamentListTable.jsx";
import TournamentPageHeader from "../../../components/tournament/TournamentPageHeader.jsx";
import { usePageRuntimeAccess } from "../../../core/platform/app/usePageRuntimeAccess.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/index.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/index.js";
import { getTeamData } from "../../team-tournament/engines/teamTournamentEngine.js";
import { findTeamForCaptain } from "../../team-tournament/engines/teamPermissionEngine.js";
import { buildCaptainPortalPath } from "../../../components/tournament/team/copyPortalLink.js";
import { listTournamentsQuery } from "../services/tournamentQueries.js";
import { deleteTournamentCommand } from "../services/tournamentCommands.js";

function canDeleteTournament(tournament) {
  return (
    tournament.status === TOURNAMENT_STATUS.DRAFT ||
    tournament.status === TOURNAMENT_STATUS.CANCELLED
  );
}

export default function CanonicalTournamentListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeClub, activeClubId, revision, refreshClubs } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();
  const { accessAllowed } = usePageRuntimeAccess(
    "tournament.manage",
    activeClub?.tenantId || activeClubId,
    { source: "tournament.canonical.list" }
  );
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const tournaments = useMemo(() => {
    void revision;
    return listTournamentsQuery(activeClubId);
  }, [activeClubId, revision]);

  const contextLine = [
    activeClub?.name ? `CLB ${activeClub.name}` : null,
    activeSeason?.name || null,
    activeLeague?.name || null,
  ]
    .filter(Boolean)
    .join(" • ");

  const deletableSelectedCount = useMemo(
    () =>
      tournaments.filter(
        (tournament) =>
          selectedIds.includes(tournament.id) && canDeleteTournament(tournament)
      ).length,
    [tournaments, selectedIds]
  );

  const isCaptainForTeamTournament = (tournament) => {
    const playerId = user?.playerId;
    if (!playerId || tournament?.mode !== TOURNAMENT_MODE.TEAM_TOURNAMENT) {
      return false;
    }
    const teamData = getTeamData(tournament);
    return Boolean(findTeamForCaptain(teamData, playerId));
  };

  const handleConfirmDelete = () => {
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác quản lý giải đấu.");
      return;
    }
    setError(null);
    setMessage(null);
    let deletedCount = 0;
    const blocked = [];
    selectedIds.forEach((tournamentId) => {
      const tournament = tournaments.find((item) => item.id === tournamentId);
      if (!tournament) return;
      const result = deleteTournamentCommand(activeClubId, tournamentId);
      if (result.ok) {
        deletedCount += 1;
        return;
      }
      blocked.push(tournament.name);
    });
    refreshClubs();
    setSelectedIds([]);
    setDeleteDialogOpen(false);
    if (deletedCount > 0) setMessage(`Đã xóa ${deletedCount} giải.`);
    if (blocked.length > 0) {
      setError(
        `Không thể xóa ${blocked.length} giải (chỉ xóa được giải Nháp hoặc Đã hủy).`
      );
    }
  };

  return (
    <Box>
      <TournamentPageHeader
        title="Danh sách giải"
        description="Xem và quản lý tất cả giải trong phạm vi hiện tại (cùng nguồn đọc với Giải của tôi)."
        contextLine={contextLine || undefined}
      />
      <ClubAssignmentBanner />

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
