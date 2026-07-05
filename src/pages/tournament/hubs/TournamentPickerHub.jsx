import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { useClub } from "../../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../../context/SeasonContext.jsx";
import { listTournaments } from "../../../domain/tournamentService.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/index.js";
const STATUS_LABELS = {
  [TOURNAMENT_STATUS.DRAFT]: "Nháp",
  [TOURNAMENT_STATUS.REGISTRATION]: "Đăng ký",
  [TOURNAMENT_STATUS.READY]: "Sẵn sàng",
  [TOURNAMENT_STATUS.ACTIVE]: "Đang diễn ra",
  [TOURNAMENT_STATUS.COMPLETED]: "Hoàn thành",
  [TOURNAMENT_STATUS.CANCELLED]: "Đã hủy",
};

function rankTournaments(tournaments, { seasonId, leagueId } = {}) {
  const statusWeight = {
    [TOURNAMENT_STATUS.ACTIVE]: 0,
    [TOURNAMENT_STATUS.READY]: 1,
    [TOURNAMENT_STATUS.REGISTRATION]: 2,
    [TOURNAMENT_STATUS.DRAFT]: 3,
    [TOURNAMENT_STATUS.COMPLETED]: 4,
    [TOURNAMENT_STATUS.CANCELLED]: 5,
  };

  return [...tournaments]
    .map((tournament) => {
      let score = statusWeight[tournament.status] ?? 9;
      if (leagueId && String(tournament.leagueId) === String(leagueId)) score -= 10;
      if (seasonId && String(tournament.seasonId) === String(seasonId)) score -= 5;
      return { tournament, score };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const aTime = Date.parse(a.tournament.updatedAt || a.tournament.createdAt || "") || 0;
      const bTime = Date.parse(b.tournament.updatedAt || b.tournament.createdAt || "") || 0;
      return bTime - aTime;
    })
    .map((item) => item.tournament);
}

/**
 * Hub chọn giải rồi điều hướng tới màn hình thật.
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {(tournament: object) => boolean} props.filter
 * @param {(tournament: object) => string|null} props.resolvePath
 * @param {boolean} [props.autoNavigateSingle=true]
 * @param {string} [props.emptyHint]
 */
export default function TournamentPickerHub({
  title,
  description,
  filter,
  resolvePath,
  autoNavigateSingle = true,
  emptyHint,
}) {
  const navigate = useNavigate();
  const { activeClubId, revision } = useClub();
  const { activeSeason, activeLeague } = useSeasonLeague();

  const tournaments = useMemo(
    () => listTournaments(activeClubId),
    [activeClubId, revision]
  );

  const matches = useMemo(
    () =>
      rankTournaments(tournaments.filter(filter), {
        seasonId: activeSeason?.id,
        leagueId: activeLeague?.id,
      }),
    [tournaments, filter, activeSeason?.id, activeLeague?.id]
  );

  useEffect(() => {
    if (!autoNavigateSingle || matches.length !== 1) return;
    const path = resolvePath(matches[0]);
    if (path) {
      navigate(path, { replace: true });
    }
  }, [autoNavigateSingle, matches, navigate, resolvePath]);

  if (autoNavigateSingle && matches.length === 1) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}

      {matches.length === 0 ? (
        <Alert severity="info">
          {emptyHint || "Chưa có giải phù hợp. Tạo giải mới từ mục Tạo giải."}
        </Alert>
      ) : (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Chọn giải
            </Typography>
            <Chip size="small" label={`${matches.length} giải`} />
          </Stack>
          <List dense disablePadding>
            {matches.map((tournament) => {
              const path = resolvePath(tournament);
              return (
                <ListItem key={tournament.id} disablePadding divider>
                  <ListItemButton
                    disabled={!path}
                    onClick={() => path && navigate(path)}
                    sx={{ py: 1 }}
                  >
                    <ListItemText
                      primary={tournament.name}
                      secondary={
                        STATUS_LABELS[tournament.status] || tournament.status
                      }
                    />
                    {path ? <ChevronRightIcon fontSize="small" color="action" /> : null}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}

      <Button variant="text" sx={{ mt: 2 }} onClick={() => navigate("/tournament")}>
        ← Về Tổng quan giải đấu
      </Button>
    </Box>
  );
}
