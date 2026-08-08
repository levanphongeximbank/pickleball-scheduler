import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../context/SeasonContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS } from "../../auth/permissions.js";
import { resolveDailyPlayEntry } from "../../domain/quickTournamentActions.js";

export default function DailyPlayLauncher() {
  const navigate = useNavigate();
  const { activeClubId, refreshClubs } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();
  const { can } = useAuth();
  const [error, setError] = useState(null);

  const canCreate = can(PERMISSIONS.TOURNAMENT_UPDATE, {
    clubId: activeClubId,
  });

  useEffect(() => {
    let cancelled = false;

    async function openDaily() {
      if (!activeClubId) {
        setError("Chưa chọn CLB. Hãy chọn CLB ở header rồi mở lại Chơi hằng ngày.");
        return;
      }

      const result = await resolveDailyPlayEntry(activeClubId, {
        seasonId: activeSeason?.id,
        leagueId: activeLeague?.id,
        allowCreate: canCreate,
      });

      if (cancelled) return;

      if (result.ok) {
        if (result.created) {
          refreshClubs();
        }
        navigate(`/tournament/daily/${result.tournament.id}`, { replace: true });
        return;
      }

      setError(result.error || "Không mở được buổi chơi hằng ngày.");
    }

    openDaily();
    return () => {
      cancelled = true;
    };
  }, [
    activeClubId,
    activeSeason?.id,
    activeLeague?.id,
    canCreate,
    navigate,
    refreshClubs,
  ]);

  if (error) {
    return (
      <Box sx={{ maxWidth: 520 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
          Chơi hằng ngày
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button component={RouterLink} to="/tournament/create" variant="contained">
            Tạo giải đấu
          </Button>
          <Button component={RouterLink} to="/tournament" variant="outlined">
            Về Giải đấu
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack spacing={1.5} alignItems="center">
        <CircularProgress size={28} />
        <Typography color="text.secondary">Đang mở buổi chơi hằng ngày...</Typography>
      </Stack>
    </Box>
  );
}
