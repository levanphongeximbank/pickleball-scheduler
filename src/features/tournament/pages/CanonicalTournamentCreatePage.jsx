import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Alert, Box, Grid, Typography } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import SportsIcon from "@mui/icons-material/Sports";

import { useClub } from "../../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../../context/SeasonContext.jsx";
import ModeCard from "../../../components/tournament/ModeCard.jsx";
import PermissionGate from "../../../components/auth/PermissionGate.jsx";
import ClubAssignmentBanner from "../../../components/auth/ClubAssignmentBanner.jsx";
import TournamentPageHeader from "../../../components/tournament/TournamentPageHeader.jsx";
import { TOURNAMENT_LAYOUT } from "../../../components/tournament/tournamentLayout.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { usePageRuntimeAccess } from "../../../core/platform/app/usePageRuntimeAccess.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/index.js";
import { resolveEventTypeFromQuery } from "../../individual-tournament/index.js";
import { EVENT_TYPE_LABELS } from "../../../models/tournament/index.js";
import { createTournamentCommand } from "../services/tournamentCommands.js";
import { modeLabelVi } from "../constants/tournamentLabels.js";

const CREATE_OPTIONS = [
  {
    mode: TOURNAMENT_MODE.DAILY_PLAY,
    title: modeLabelVi(TOURNAMENT_MODE.DAILY_PLAY),
    description:
      "Check-in trong ngày, ghép trận công bằng, xếp sân và ghi kết quả cho buổi chơi hằng ngày.",
    icon: <SportsIcon sx={{ fontSize: 18 }} />,
    badge: "Hằng ngày",
    capabilities: ["check-in", "ghép cặp", "xếp sân", "kết quả"],
  },
  {
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    title: modeLabelVi(TOURNAMENT_MODE.INTERNAL_TOURNAMENT),
    description:
      "Hạt giống, chia bảng, bracket, lịch và trọng tài cho giải nội bộ CLB.",
    icon: <GroupsIcon sx={{ fontSize: 18 }} />,
    badge: "Nội bộ",
    capabilities: ["hạt giống AI", "bracket", "lịch", "trọng tài", "kết quả"],
  },
  {
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    title: modeLabelVi(TOURNAMENT_MODE.OFFICIAL_TOURNAMENT),
    description:
      "Giải nhiều CLB, nhiều nội dung; hỗ trợ mở rộng và cân bằng AI khi được bật.",
    icon: <EmojiEventsIcon sx={{ fontSize: 18 }} />,
    badge: "Chính thức",
    capabilities: ["đăng ký", "AI", "bracket", "lịch", "trọng tài", "kết quả"],
  },
  {
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    title: modeLabelVi(TOURNAMENT_MODE.TEAM_TOURNAMENT),
    description:
      "Đội hình, phân công, Dreambreaker khi hòa 2-2, trọng tài và bảng xếp hạng đồng đội.",
    icon: <Diversity3Icon sx={{ fontSize: 18 }} />,
    badge: "Đồng đội",
    capabilities: ["roster", "Dreambreaker", "trọng tài", "kết quả"],
  },
];

export default function CanonicalTournamentCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedEvent = resolveEventTypeFromQuery(searchParams.get("event"));
  const { activeClub, activeClubId, refreshClubs } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();
  const { accessAllowed } = usePageRuntimeAccess(
    "tournament.manage",
    activeClub?.tenantId || activeClubId,
    { source: "tournament.canonical.create" }
  );
  const [error, setError] = useState(null);

  const handleStartMode = async (option) => {
    if (!accessAllowed) {
      setError("Runtime platform chặn thao tác quản lý giải đấu.");
      return;
    }

    setError(null);
    const result = await createTournamentCommand(activeClubId, {
      mode: option.mode,
      seasonId: activeSeason?.id,
      leagueId: activeLeague?.id,
      hostClubName:
        option.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
          ? activeClub?.name || ""
          : undefined,
    });

    if (!result.ok || !result.tournament?.id) {
      setError(result.error || "Không thể tạo giải.");
      return;
    }

    if (option.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
      const hostClubId = String(result.clubId || activeClubId || "").trim();
      navigate(
        `/tournament/team/${result.tournament.id}?club=${encodeURIComponent(hostClubId)}`
      );
      refreshClubs();
      return;
    }

    refreshClubs();

    if (option.mode === TOURNAMENT_MODE.DAILY_PLAY) {
      navigate(`/tournament/daily/${result.tournament.id}`);
      return;
    }
    if (option.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
      navigate(
        preselectedEvent
          ? `/tournament/internal/${result.tournament.id}?event=${preselectedEvent}`
          : `/tournament/internal/${result.tournament.id}`
      );
      return;
    }
    if (option.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
      navigate(
        preselectedEvent
          ? `/tournament/official/${result.tournament.id}?event=${preselectedEvent}`
          : `/tournament/official/${result.tournament.id}`
      );
    }
  };

  return (
    <Box>
      <TournamentPageHeader
        title="Tạo giải"
        description="Chọn loại hình giải. Khả năng hỗ trợ: đăng ký, roster, AI, Dreambreaker, trọng tài, bracket, lịch và kết quả."
      />
      <ClubAssignmentBanner />

      {preselectedEvent ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nội dung được chọn trước:{" "}
          {EVENT_TYPE_LABELS[preselectedEvent] || preselectedEvent}
        </Alert>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <PermissionGate permission={PERMISSIONS.TOURNAMENT_UPDATE}>
        <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing}>
          {CREATE_OPTIONS.map((option) => (
            <Grid key={option.mode} size={{ xs: 12, sm: 6, lg: 4 }}>
              <ModeCard
                title={option.title}
                description={`${option.description} (${option.capabilities.join(", ")}).`}
                icon={option.icon}
                mode={option.mode}
                badge={option.badge}
                onStart={() => handleStartMode(option)}
              />
            </Grid>
          ))}
        </Grid>
      </PermissionGate>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        Engine 4.0 (hạt giống, bốc thăm, lịch, sân, xếp hạng) mở từ màn hình tổ chức sau khi tạo giải.
      </Typography>
    </Box>
  );
}
