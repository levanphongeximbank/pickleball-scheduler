import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../../../context/SeasonContext.jsx";
import ClubAssignmentBanner from "../../../../components/auth/ClubAssignmentBanner.jsx";
import TournamentPageHeader from "../../../../components/tournament/TournamentPageHeader.jsx";
import { TournamentModeChip, TournamentStatusChip } from "../../../../components/tournament/TournamentStatusChip.jsx";
import { tournamentCardHoverSx, tournamentCardSx, TOURNAMENT_LAYOUT } from "../../../../components/tournament/tournamentLayout.js";
import { touchButtonSx } from "../../../../components/tournament/mobileUi.js";
import { usePageRuntimeAccess } from "../../../../components/shell/usePageRuntimeAccess.js";
import { TOURNAMENT_ROUTES, isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../../models/tournament/constants.js";
import { useCanonicalTournamentList } from "../../hooks/useCanonicalTournament.js";
import { modeLabelVi } from "../../constants/tournamentLabels.js";
import { CANONICAL_TOURNAMENT_HUB_ITEMS } from "../../constants/hubNav.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import TournamentKpiCard, { TournamentRightRailCard } from "../components/TournamentKpiCard.jsx";
import { a1LegacyHubPath, resolveA1OpenPath } from "../routes.js";

const CREATE_TYPES = [
  {
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    title: "Giải nội bộ",
    hint: "Một nội dung, vận hành gọn trong CLB.",
  },
  {
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    title: "Giải chính thức / mở rộng",
    hint: "Nhiều nội dung, đăng ký và trang công khai.",
  },
];

function countEvents(tournament) {
  return Array.isArray(tournament?.events) ? tournament.events.length : 0;
}

export default function TournamentCenterExperiencePage() {
  const navigate = useNavigate();
  const { activeClub, activeClubId, revision } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();
  const { accessAllowed } = usePageRuntimeAccess(
    "tournament.manage",
    activeClub?.tenantId || activeClubId,
    { source: "tournament.experience-a1.center" }
  );
  const { tournaments, loading, error, stats } = useCanonicalTournamentList(activeClub, revision);
  const [query, setQuery] = useState("");

  const contextLine = [
    activeClub?.name ? `CLB ${activeClub.name}` : null,
    activeSeason?.name || null,
    activeLeague?.name || null,
  ]
    .filter(Boolean)
    .join(" • ");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tournaments.filter((item) => {
      if (!needle) return true;
      return String(item.name || "").toLowerCase().includes(needle);
    });
  }, [tournaments, query]);

  const openTournaments = filtered.filter((item) =>
    [TOURNAMENT_STATUS.ACTIVE, TOURNAMENT_STATUS.READY, TOURNAMENT_STATUS.REGISTRATION].includes(
      item.status
    )
  );
  const draftTournaments = filtered.filter((item) => item.status === TOURNAMENT_STATUS.DRAFT);

  return (
    <Box sx={{ width: "100%", minWidth: 0, overflowX: "hidden" }}>
      <TournamentPageHeader
        title="Trung tâm giải đấu"
        description="Vận hành giải cá nhân / chính thức trên dữ liệu production. Giải đồng đội và chơi hằng ngày vẫn dùng trang hiện tại."
        contextLine={contextLine || undefined}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => navigate(TOURNAMENT_ROUTES.create)}
              sx={touchButtonSx}
            >
              Tạo giải
            </Button>
            <Button
              variant="outlined"
              size="small"
              component={RouterLink}
              to={a1LegacyHubPath()}
              sx={touchButtonSx}
            >
              Giao diện cũ
            </Button>
          </Stack>
        }
      />

      <ClubAssignmentBanner />

      {!accessAllowed ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Runtime platform hạn chế thao tác quản lý giải đấu.
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {loading ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Đang tải giải đấu từ cloud...
        </Alert>
      ) : null}

      <TournamentExperienceWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Phạm vi hiện tại">
              <Typography variant="body2">{contextLine || "Chưa chọn CLB / mùa / giải nội bộ."}</Typography>
              <Typography variant="caption" color="text.secondary">
                Số liệu KPI lấy từ danh sách canonical, không dùng dữ liệu mẫu.
              </Typography>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Vòng đời (trang hiện có)">
              {CANONICAL_TOURNAMENT_HUB_ITEMS.slice(0, 6).map((item) => (
                <Button
                  key={item.key}
                  component={RouterLink}
                  to={item.path}
                  size="small"
                  variant="text"
                  sx={{ justifyContent: "flex-start", ...touchButtonSx }}
                >
                  {item.title}
                </Button>
              ))}
            </TournamentRightRailCard>
          </>
        }
      >
        <Grid container spacing={1.25} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <TournamentKpiCard label="Tổng số giải" value={stats.total} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TournamentKpiCard label="Đang mở" value={stats.open} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TournamentKpiCard label="Nháp" value={stats.draft} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TournamentKpiCard label="Đã kết thúc" value={stats.completed} />
          </Grid>
        </Grid>

        <Typography sx={{ fontWeight: 700, mb: 1 }}>Tạo giải cá nhân</Typography>
        <Grid container spacing={1.25} sx={{ mb: 2 }}>
          {CREATE_TYPES.map((item) => (
            <Grid key={item.mode} size={{ xs: 12, sm: 6 }}>
              <Paper
                variant="outlined"
                sx={{ ...tournamentCardSx, ...tournamentCardHoverSx, p: 1.5, cursor: "pointer" }}
                onClick={() => navigate(TOURNAMENT_ROUTES.create)}
              >
                <Typography fontWeight={700}>{item.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.hint}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Button
          size="small"
          variant="text"
          onClick={() => navigate(TOURNAMENT_ROUTES.create)}
          sx={{ mb: 2, ...touchButtonSx }}
        >
          Loại giải khác (đồng đội / chơi hằng ngày) — trang tạo hiện tại
        </Button>

        <TextField
          size="small"
          fullWidth
          placeholder="Tìm theo tên giải"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ mb: 2, maxWidth: 420 }}
        />

        <TournamentListBlock
          title="Giải đang mở"
          empty="Không có giải đang mở trong phạm vi hiện tại."
          tournaments={openTournaments}
        />
        <TournamentListBlock
          title="Giải nháp"
          empty="Không có giải nháp."
          tournaments={draftTournaments}
        />
      </TournamentExperienceWorkspace>
    </Box>
  );
}

function TournamentListBlock({ title, empty, tournaments }) {
  return (
    <Box sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
      <Typography sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
      {tournaments.length === 0 ? (
        <Alert severity="info">{empty}</Alert>
      ) : (
        <Stack spacing={1}>
          {tournaments.map((tournament) => (
            <TournamentCenterRow key={tournament.id} tournament={tournament} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function TournamentCenterRow({ tournament }) {
  const navigate = useNavigate();
  const eventCount = countEvents(tournament);
  const familyHint = isIndividualTournament(tournament)
    ? eventCount
      ? `${eventCount} nội dung`
      : "Chưa có nội dung"
    : modeLabelVi(tournament.mode);

  return (
    <Paper
      variant="outlined"
      sx={{ ...tournamentCardSx, ...tournamentCardHoverSx, p: 1.5, cursor: "pointer" }}
      onClick={() => navigate(resolveA1OpenPath(tournament))}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>
            {tournament.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {familyHint}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <TournamentModeChip mode={tournament.mode} />
          <TournamentStatusChip status={tournament.status} />
          {isIndividualTournament(tournament) ? (
            <Chip size="small" variant="outlined" label="Tổng quan" />
          ) : (
            <Chip size="small" variant="outlined" label="Trang hiện tại" />
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
