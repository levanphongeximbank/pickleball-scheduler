import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Typography,
} from "@mui/material";

import GroupsIcon from "@mui/icons-material/Groups";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Diversity3Icon from "@mui/icons-material/Diversity3";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../context/SeasonContext.jsx";
import ActiveTournamentsPanel from "../../components/tournament/ActiveTournamentsPanel.jsx";
import TournamentListTable from "../../components/tournament/TournamentListTable.jsx";
import TournamentPageHeader from "../../components/tournament/TournamentPageHeader.jsx";
import {
  createTournament,
  deleteTournament,
  listTournaments,
} from "../../domain/tournamentService.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS, OFFICIAL_MODE } from "../../models/tournament/index.js";
import ModeCard from "../../components/tournament/ModeCard.jsx";
import PermissionGate from "../../components/auth/PermissionGate.jsx";
import ClubAssignmentBanner from "../../components/auth/ClubAssignmentBanner.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { usePageRuntimeAccess } from "../../core/platform/app/usePageRuntimeAccess.js";
import { createTeamTournament } from "../../features/team-tournament/services/teamTournamentService.js";
import { getTeamData } from "../../features/team-tournament/engines/teamTournamentEngine.js";
import { findTeamForCaptain } from "../../features/team-tournament/engines/teamPermissionEngine.js";
import { TOURNAMENT_LAYOUT } from "../../components/tournament/tournamentLayout.js";

const SECTION_META = {
  overview: {
    title: "Tổng quan",
    description: "Tạo giải mới, theo dõi giải đang mở và quản lý danh sách giải.",
  },
  create: {
    title: "Tạo giải",
    description: "Chọn loại giải để tạo giải nháp mới.",
  },
  list: {
    title: "Danh sách giải",
    description: "Xem và quản lý tất cả giải trong CLB hiện tại.",
  },
};

const CREATE_TOURNAMENT_MODE_OPTIONS = [
  {
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    title: "Giải nội bộ CLB",
    description:
      "Chia bảng theo hạt giống, vòng bảng, bán kết/chung kết và bracket cho giải nội bộ CLB.",
    icon: <GroupsIcon sx={{ fontSize: 18 }} />,
    badge: "Internal",
  },
  {
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    title: "Giải chính thức / mở rộng",
    description:
      "Giải nhiều CLB, nhiều nội dung thi đấu, Open Mode hoặc AI Balance Mode.",
    icon: <EmojiEventsIcon sx={{ fontSize: 18 }} />,
    badge: "Official",
  },
  {
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    title: "Giải đồng đội MLP",
    description:
      "MLP 4 người (2M+2F): đôi nữ → đôi nam → mixed×2, Dreambreaker khi 2-2, Rally 21 điểm.",
    icon: <Diversity3Icon sx={{ fontSize: 18 }} />,
    badge: "MLP",
  },
];

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

export default function TournamentHome({ section = "overview" }) {
  const navigate = useNavigate();
  const createRef = useRef(null);
  const listRef = useRef(null);
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

  const showCreateSection = section === "overview" || section === "create";
  const showActiveSection = section === "overview";
  const showListSection = section === "overview" || section === "list";
  const sectionMeta = SECTION_META[section] || SECTION_META.overview;

  const contextLine = [
    activeClub?.name ? `CLB ${activeClub.name}` : null,
    activeSeason?.name || null,
    activeLeague?.name || null,
  ]
    .filter(Boolean)
    .join(" • ");

  useEffect(() => {
    const target = section === "create" ? createRef : section === "list" ? listRef : null;
    if (target?.current) {
      target.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [section]);

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
      checked ? [...prev, tournamentId] : prev.filter((id) => id !== tournamentId)
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
      if (!tournament) return;

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
            formatPreset: "mlp_4",
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

  const isCaptainForTeamTournament = (tournament) => {
    const playerId = user?.playerId;
    if (!playerId || tournament?.mode !== TOURNAMENT_MODE.TEAM_TOURNAMENT) {
      return false;
    }
    const teamData = getTeamData(tournament);
    return Boolean(findTeamForCaptain(teamData, playerId));
  };

  return (
    <Box>
      <TournamentPageHeader
        title={sectionMeta.title}
        description={sectionMeta.description}
        contextLine={contextLine || undefined}
      />

      <ClubAssignmentBanner />

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

      {showCreateSection ? (
        <Box ref={createRef} sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Tạo giải mới
          </Typography>
          <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
            <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing}>
              {CREATE_TOURNAMENT_MODE_OPTIONS.map((option) => (
                <Grid key={option.mode} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <ModeCard
                    title={option.title}
                    description={option.description}
                    icon={option.icon}
                    mode={option.mode}
                    badge={option.badge}
                    onStart={() => handleStartMode(option)}
                  />
                </Grid>
              ))}
            </Grid>
          </PermissionGate>
        </Box>
      ) : null}

      {showActiveSection ? (
        <Box sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
          <ActiveTournamentsPanel tournaments={tournaments} title="Giải đang mở" />
        </Box>
      ) : null}

      {showListSection ? (
        <Box ref={listRef}>
          <TournamentListTable
            tournaments={tournaments}
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onDeleteSelected={() => setDeleteDialogOpen(true)}
            canDeleteTournament={canDeleteTournament}
            showCaptainPortal={isCaptainForTeamTournament}
            onCaptainPortal={(tournament) => navigate(`/team-portal/${tournament.id}`)}
          />
        </Box>
      ) : null}

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
