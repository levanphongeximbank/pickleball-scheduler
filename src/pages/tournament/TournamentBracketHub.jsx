import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { useClub } from "../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../context/SeasonContext.jsx";
import { listTournaments } from "../../domain/tournamentService.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../models/tournament/index.js";
import { getTournamentBracketPath,
  getTournamentSetupPath,
  isBracketTournament,
  rankTournamentsForBracket,
} from "../../utils/tournamentNavigation.js";
import TournamentPageHeader from "../../components/tournament/TournamentPageHeader.jsx";
import { tournamentCardHoverSx, tournamentCardSx } from "../../components/tournament/tournamentLayout.js";

const MODE_LABELS = {
  [TOURNAMENT_MODE.INTERNAL_TOURNAMENT]: "Nội bộ",
  [TOURNAMENT_MODE.OFFICIAL_TOURNAMENT]: "Chính thức",
};

const STATUS_LABELS = {
  [TOURNAMENT_STATUS.ACTIVE]: "Đang diễn ra",
  [TOURNAMENT_STATUS.READY]: "Sẵn sàng",
  [TOURNAMENT_STATUS.REGISTRATION]: "Đăng ký",
  [TOURNAMENT_STATUS.COMPLETED]: "Hoàn thành",
  [TOURNAMENT_STATUS.DRAFT]: "Nháp",
};

export default function TournamentBracketHub() {
  const navigate = useNavigate();
  const { activeClubId, revision } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();

  const tournaments = useMemo(
    () => listTournaments(activeClubId),
    [activeClubId, revision]
  );

  const bracketTournaments = useMemo(
    () =>
      rankTournamentsForBracket(tournaments, {
        seasonId: activeSeason?.id,
        leagueId: activeLeague?.id,
      }),
    [tournaments, activeSeason?.id, activeLeague?.id]
  );

  const pendingSetup = useMemo(
    () =>
      tournaments.filter(
        (tournament) =>
          isBracketTournament(tournament) &&
          tournament.status !== TOURNAMENT_STATUS.CANCELLED &&
          tournament.status !== TOURNAMENT_STATUS.DRAFT
      ),
    [tournaments]
  );

  useEffect(() => {
    if (bracketTournaments.length === 1) {
      const path = getTournamentBracketPath(bracketTournaments[0]);
      if (path) {
        navigate(path, { replace: true });
      }
    }
  }, [bracketTournaments, navigate]);

  if (bracketTournaments.length === 1) {
    return null;
  }

  return (
    <Box>
      <TournamentPageHeader
        title="Sơ đồ thi đấu"
        description={`Chọn giải để xem bracket knock-out của ${activeLeague?.name || "giải hiện tại"}.`}
      />

      {bracketTournaments.length > 0 ? (
        <Stack spacing={1.5}>
          {bracketTournaments.map((tournament) => (
            <Paper
              key={tournament.id}
              variant="outlined"
              elevation={0}
              sx={{
                ...tournamentCardSx,
                ...tournamentCardHoverSx,
                p: 2,
                cursor: "pointer",
                "&:hover": {
                  ...tournamentCardHoverSx["&:hover"],
                  transform: "translateY(-1px)",
                },
              }}
              onClick={() => {
                const path = getTournamentBracketPath(tournament);
                if (path) navigate(path);
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>
                    {tournament.name}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }} flexWrap="wrap">
                    <Chip
                      size="small"
                      label={MODE_LABELS[tournament.mode] || "Giải"}
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={STATUS_LABELS[tournament.status] || tournament.status}
                    />
                  </Stack>
                </Box>
                <Button endIcon={<ChevronRightIcon />} variant="contained" size="small">
                  Mở sơ đồ
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          {pendingSetup.length > 0
            ? "Các giải đã tạo nhưng chưa có sơ đồ knock-out. Nhập đủ điểm vòng bảng — bracket sẽ được tạo tự động."
            : "Chưa có giải nội bộ/chính thức nào có sơ đồ thi đấu."}
        </Alert>
      )}

      {pendingSetup.length > 0 && bracketTournaments.length === 0 && (
        <Stack spacing={1}>
          {pendingSetup.map((tournament) => (
            <Button
              key={tournament.id}
              variant="outlined"
              onClick={() => navigate(getTournamentSetupPath(tournament))}
              sx={{ justifyContent: "flex-start" }}
            >
              Thiết lập giải: {tournament.name}
            </Button>
          ))}
        </Stack>
      )}

      <Button sx={{ mt: 3 }} onClick={() => navigate("/tournament")}>
        Về danh sách giải
      </Button>
    </Box>
  );
}
