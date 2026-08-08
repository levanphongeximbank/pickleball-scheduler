import { useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import { useClub } from "../../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../../context/SeasonContext.jsx";
import ClubAssignmentBanner from "../../../components/auth/ClubAssignmentBanner.jsx";
import TournamentPageHeader from "../../../components/tournament/TournamentPageHeader.jsx";
import ActiveTournamentsPanel from "../../../components/tournament/ActiveTournamentsPanel.jsx";
import { TOURNAMENT_LAYOUT } from "../../../components/tournament/tournamentLayout.js";
import { usePageRuntimeAccess } from "../../../core/platform/app/usePageRuntimeAccess.js";
import { CANONICAL_TOURNAMENT_HUB_ITEMS } from "../constants/hubNav.js";
import { useCanonicalTournamentList } from "../hooks/useCanonicalTournament.js";
import { TOURNAMENT_ROUTES } from "../../../config/tournamentRoutes.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";

export default function CanonicalTournamentHubPage() {
  const navigate = useNavigate();
  const { activeClub, activeClubId, revision } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();
  const { accessAllowed } = usePageRuntimeAccess(
    "tournament.manage",
    activeClub?.tenantId || activeClubId,
    { source: "tournament.canonical.hub" }
  );
  const { tournaments, loading, error, stats } = useCanonicalTournamentList(activeClub || { id: activeClubId },
    revision
  );
  const openTournaments = tournaments.filter((item) =>
    [TOURNAMENT_STATUS.ACTIVE, TOURNAMENT_STATUS.READY, TOURNAMENT_STATUS.REGISTRATION].includes(
      item.status
    )
  );

  const contextLine = [
    activeClub?.name ? `CLB ${activeClub.name}` : null,
    activeSeason?.name || null,
    activeLeague?.name || null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Box>
      <TournamentPageHeader
        title="Giải đấu"
        description="Trung tâm quản lý vòng đời giải: tạo, đăng ký, tổ chức, trọng tài và kết quả."
        contextLine={contextLine || undefined}
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

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Tổng số giải: <strong>{stats.total}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Đang mở: <strong>{stats.open}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Nháp: <strong>{stats.draft}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Đã kết thúc: <strong>{stats.completed}</strong>
        </Typography>
      </Stack>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Vòng đời giải đấu
      </Typography>
      <Grid container spacing={TOURNAMENT_LAYOUT.gridSpacing} sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
        {CANONICAL_TOURNAMENT_HUB_ITEMS.map((item) => (
          <Grid key={item.key} size={{ xs: 12, sm: 6, md: 4 }}>
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Typography fontWeight={700}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                {item.description}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate(item.path)}
                sx={{ alignSelf: "flex-start" }}
              >
                Mở
              </Button>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: TOURNAMENT_LAYOUT.sectionGap }}>
        <ActiveTournamentsPanel tournaments={openTournaments} title="Giải đang mở" />
      </Box>

      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => navigate(TOURNAMENT_ROUTES.create)}>
          Tạo giải
        </Button>
        <Button variant="outlined" onClick={() => navigate(TOURNAMENT_ROUTES.list)}>
          Danh sách giải
        </Button>
      </Stack>
    </Box>
  );
}
