import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import GroupsIcon from "@mui/icons-material/Groups";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import SportsIcon from "@mui/icons-material/Sports";

import { useAuth } from "../../context/AuthContext.jsx";

import { useClub } from "../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../context/SeasonContext.jsx";
import ActiveTournamentsPanel from "../../components/tournament/ActiveTournamentsPanel.jsx";
import {
  createTournament,
  deleteTournament,
  listTournaments,
} from "../../domain/tournamentService.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS, OFFICIAL_MODE } from "../../models/tournament/index.js";
import ModeCard from "../../components/tournament/ModeCard.jsx";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { usePageRuntimeAccess } from "../../core/platform/app/usePageRuntimeAccess.js";
import { createTeamTournament } from "../../features/team-tournament/services/teamTournamentService.js";
import { getTeamData } from "../../features/team-tournament/engines/teamTournamentEngine.js";
import { findTeamForCaptain } from "../../features/team-tournament/engines/teamPermissionEngine.js";

const CREATE_TOURNAMENT_MODE_OPTIONS = [
  {
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    title: "Giải nội bộ CLB",
    description:
      "Chia bảng theo hạt giống, vòng bảng, bán kết/chung kết và bracket cho giải nội bộ CLB.",
    icon: <GroupsIcon />,
    color: "#16a34a",
    badge: "Internal",
  },
  {
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    title: "Giải chính thức / mở rộng",
    description:
      "Giải nhiều CLB, nhiều nội dung thi đấu, Open Mode hoặc AI Balance Mode.",
    icon: <EmojiEventsIcon />,
    color: "#dc2626",
    badge: "Official",
  },
  {
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    title: "Giải đồng đội",
    description:
      "Đội vs đội, nộp đội hình theo lượt, khóa/công bố cặp đấu, BXH đồng đội.",
    icon: <Diversity3Icon />,
    color: "#7c3aed",
    badge: "Team",
  },
];

const STATUS_LABELS = {
  [TOURNAMENT_STATUS.DRAFT]: "Nháp",
  [TOURNAMENT_STATUS.REGISTRATION]: "Đăng ký",
  [TOURNAMENT_STATUS.READY]: "Sẵn sàng",
  [TOURNAMENT_STATUS.ACTIVE]: "Đang diễn ra",
  [TOURNAMENT_STATUS.COMPLETED]: "Hoàn thành",
  [TOURNAMENT_STATUS.CANCELLED]: "Đã hủy",
};

const MODE_LABELS = {
  [TOURNAMENT_MODE.DAILY_PLAY]: "Chơi vui",
  [TOURNAMENT_MODE.INTERNAL_TOURNAMENT]: "Nội bộ",
  [TOURNAMENT_MODE.OFFICIAL_TOURNAMENT]: "Chính thức",
  [TOURNAMENT_MODE.TEAM_TOURNAMENT]: "Đồng đội",
};

function buildDefaultName(modeLabel) {
  const date = new Date().toLocaleDateString("vi-VN");
  return `${modeLabel} ${date}`;
}

function canDeleteTournament(tournament) {
  return (
    tournament.status === TOURNAMENT_STATUS.DRAFT ||
    tournament.status === TOURNAMENT_STATUS.CANCELLED
  );
}

function isCaptainForTeamTournament(tournament, playerId) {
  if (!playerId || tournament?.mode !== TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    return false;
  }

  const teamData = getTeamData(tournament);
  return Boolean(findTeamForCaptain(teamData, playerId));
}

export default function TournamentHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeClub, activeClubId, revision, refreshClubs } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();
  const { accessAllowed } = usePageRuntimeAccess("tournament.manage", activeClub?.tenantId || activeClubId, {
    source: "tournament.home",
  });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const tournaments = useMemo(
    () => listTournaments(activeClubId),
    [activeClubId, revision]
  );

  const deletableSelectedCount = useMemo(
    () =>
      tournaments.filter(
        (tournament) =>
          selectedIds.includes(tournament.id) && canDeleteTournament(tournament)
      ).length,
    [tournaments, selectedIds]
  );

  const handleToggleSelection = (tournamentId, checked) => {
    setSelectedIds((prev) =>
      checked
        ? [...prev, tournamentId]
        : prev.filter((id) => id !== tournamentId)
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(tournaments.map((tournament) => tournament.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
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
      if (!tournament) {
        return;
      }

      const result = deleteTournament(activeClubId, tournamentId);
      if (result.ok) {
        deletedCount += 1;
        return;
      }

      blocked.push(tournament.name);
    });

    refreshClubs();
    setSelectedIds([]);
    setDeleteDialogOpen(false);

    if (deletedCount > 0) {
      setMessage(`Đã xóa ${deletedCount} giải.`);
    }

    if (blocked.length > 0) {
      setError(
        `Không thể xóa ${blocked.length} giải (chỉ xóa được giải Nháp hoặc Đã hủy): ${blocked.slice(0, 3).join(", ")}${
          blocked.length > 3 ? "..." : ""
        }`
      );
    }
  };

  const handleStartMode = (option) => {
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác quản lý giải đấu.");
      return;
    }

    setError(null);
    setMessage(null);

    const result =
      option.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT
        ? createTeamTournament(activeClubId, {
            name: buildDefaultName(option.title),
            seasonId: activeSeason?.id,
            leagueId: activeLeague?.id,
          })
        : createTournament(activeClubId, {
            name: buildDefaultName(option.title),
            mode: option.mode,
            officialMode:
              option.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
                ? OFFICIAL_MODE.OPEN
                : undefined,
            hostClubName:
              option.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
                ? activeClub?.name || ""
                : undefined,
            seasonId: activeSeason?.id,
            leagueId: activeLeague?.id,
          });

    if (!result.ok) {
      setError(result.error || "Không thể tạo giải.");
      return;
    }

    refreshClubs();

    if (option.mode === TOURNAMENT_MODE.DAILY_PLAY) {
      navigate(`/tournament/daily/${result.tournament.id}`);
      return;
    }

    if (option.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
      navigate(`/tournament/internal/${result.tournament.id}`);
      return;
    }

    if (option.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
      navigate(`/tournament/official/${result.tournament.id}`);
      return;
    }

    if (option.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
      navigate(`/tournament/team/${result.tournament.id}`);
      return;
    }

    setMessage(
      `Đã tạo giải nháp "${result.tournament.name}". Màn hình setup sẽ có ở bước tiếp theo.`
    );
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
        Giải đấu V3.3
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        CLB {activeClub?.name || "hiện tại"}
        {activeSeason ? ` • ${activeSeason.name}` : ""}
        {activeLeague ? ` • ${activeLeague.name}` : ""}
      </Typography>

      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Chip
        size="small"
        label={`Runtime access: ${accessAllowed ? "allowed" : "denied"}`}
        color={accessAllowed ? "success" : "warning"}
        sx={{ mb: 2 }}
      />

      <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {CREATE_TOURNAMENT_MODE_OPTIONS.map((option) => (
            <Grid key={option.mode} size={{ xs: 12, md: 6 }}>
              <ModeCard
                title={option.title}
                description={option.description}
                icon={option.icon}
                color={option.color}
                badge={option.badge}
                onStart={() => handleStartMode(option)}
              />
            </Grid>
          ))}
        </Grid>
      </PermissionGate>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 3 }}>
        <ActiveTournamentsPanel tournaments={tournaments} title="Giải đang mở" />
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
          sx={{ mb: 1 }}
        >
          <Typography variant="h6" fontWeight="bold">
            Giải V3.3 đã tạo
          </Typography>
          <Chip size="small" label={`${tournaments.length} giải`} />
        </Stack>

        {tournaments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có giải V3.3. Chọn Giải nội bộ hoặc Giải chính thức ở trên để tạo giải nháp.
          </Typography>
        ) : (
          <>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ mb: 1.5 }}
            >
              <Button variant="contained" size="small" onClick={handleSelectAll}>
                Chọn tất cả
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleClearSelection}
                disabled={selectedIds.length === 0}
              >
                Bỏ chọn tất cả
              </Button>
              <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                <Button
                  color="error"
                  variant="outlined"
                  size="small"
                  disabled={selectedIds.length === 0}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Xóa đã chọn ({selectedIds.length})
                </Button>
              </PermissionGate>
              <Typography variant="body2" color="text.secondary">
                Đã chọn: {selectedIds.length} / {tournaments.length} giải
              </Typography>
            </Stack>

            <List dense disablePadding>
            {tournaments.map((tournament) => (
              <ListItem key={tournament.id} disablePadding divider sx={{ alignItems: "flex-start" }}>
                <Checkbox
                  checked={selectedIds.includes(tournament.id)}
                  onChange={(event) =>
                    handleToggleSelection(tournament.id, event.target.checked)
                  }
                  onClick={(event) => event.stopPropagation()}
                  sx={{ mt: 0.5 }}
                />
                <ListItemButton
                  onClick={() => {
                    if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
                      navigate(`/tournament/daily/${tournament.id}`);
                      return;
                    }
                    if (tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
                      navigate(`/tournament/internal/${tournament.id}`);
                      return;
                    }
                    if (tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
                      navigate(`/tournament/official/${tournament.id}`);
                      return;
                    }
                    if (tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
                      navigate(`/tournament/team/${tournament.id}`);
                    }
                  }}
                  disabled={
                    tournament.mode !== TOURNAMENT_MODE.DAILY_PLAY &&
                    tournament.mode !== TOURNAMENT_MODE.INTERNAL_TOURNAMENT &&
                    tournament.mode !== TOURNAMENT_MODE.OFFICIAL_TOURNAMENT &&
                    tournament.mode !== TOURNAMENT_MODE.TEAM_TOURNAMENT
                  }
                  sx={{ px: 0, flex: 1, alignItems: "flex-start" }}
                >
                  <ListItemText
                  primary={tournament.name}
                  secondary={
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ mt: 0.5 }}
                    >
                      <Chip
                        size="small"
                        label={MODE_LABELS[tournament.mode] || tournament.mode}
                      />
                      <Chip
                        size="small"
                        color={
                          tournament.status === TOURNAMENT_STATUS.ACTIVE
                            ? "success"
                            : "default"
                        }
                        label={STATUS_LABELS[tournament.status] || tournament.status}
                      />
                      {!canDeleteTournament(tournament) ? (
                        <Chip size="small" variant="outlined" label="Không thể xóa" />
                      ) : null}
                    </Stack>
                  }
                />
                </ListItemButton>
                {(tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT ||
                  tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) && (
                  <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<AutoAwesomeIcon />}
                      onClick={() => navigate(`/tournaments/${tournament.id}/engine`)}
                      sx={{ mt: 0.5, flexShrink: 0 }}
                    >
                      Engine
                    </Button>
                  </PermissionGate>
                )}
                {tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT &&
                isCaptainForTeamTournament(tournament, user?.playerId) ? (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<SportsIcon />}
                    onClick={() => navigate(`/team-portal/${tournament.id}`)}
                    sx={{ mt: 0.5, flexShrink: 0 }}
                  >
                    Portal
                  </Button>
                ) : null}
              </ListItem>
            ))}
          </List>
          </>
        )}
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Xác nhận xóa giải</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn đã chọn <strong>{selectedIds.length}</strong> giải.
          </Typography>
          <Typography sx={{ mt: 1 }} color="text.secondary">
            Chỉ giải ở trạng thái <strong>Nháp</strong> hoặc <strong>Đã hủy</strong> mới
            được xóa. Trong số đã chọn, <strong>{deletableSelectedCount}</strong> giải có
            thể xóa.
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
            Xóa {deletableSelectedCount > 0 ? deletableSelectedCount : ""} giải
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
