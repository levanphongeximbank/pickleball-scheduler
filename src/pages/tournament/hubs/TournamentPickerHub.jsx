import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { useClub } from "../../../context/ClubContext.jsx";
import { useSeasonLeague } from "../../../context/SeasonContext.jsx";
import { listTournaments } from "../../../domain/tournamentService.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/index.js";
import TournamentPageHeader from "../../../components/tournament/TournamentPageHeader.jsx";
import TournamentSectionCard from "../../../components/tournament/TournamentSectionCard.jsx";
import { TournamentStatusChip } from "../../../components/tournament/TournamentStatusChip.jsx";
import {
  tournamentTableCellSx,
  tournamentTableHeadSx,
} from "../../../components/tournament/tournamentLayout.js";

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
      <TournamentPageHeader title={title} description={description} />

      {matches.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {emptyHint || "Chưa có giải phù hợp. Tạo giải mới từ mục Tạo giải."}
        </Alert>
      ) : (
        <TournamentSectionCard title="Chọn giải" badge={`${matches.length} giải`} noPadding contentSx={{ pt: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={tournamentTableHeadSx}>Giải đấu</TableCell>
                  <TableCell sx={tournamentTableHeadSx}>Trạng thái</TableCell>
                  <TableCell align="right" sx={tournamentTableHeadSx} />
                </TableRow>
              </TableHead>
              <TableBody>
                {matches.map((tournament) => {
                  const path = resolvePath(tournament);
                  return (
                    <TableRow
                      key={tournament.id}
                      hover={Boolean(path)}
                      sx={{ cursor: path ? "pointer" : "default" }}
                      onClick={() => path && navigate(path)}
                    >
                      <TableCell sx={tournamentTableCellSx}>
                        <Typography variant="body2" fontWeight={600}>
                          {tournament.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={tournamentTableCellSx}>
                        <TournamentStatusChip status={tournament.status} />
                      </TableCell>
                      <TableCell align="right" sx={tournamentTableCellSx}>
                        {path ? <ChevronRightIcon fontSize="small" color="action" /> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </TournamentSectionCard>
      )}

      <Button variant="text" sx={{ mt: 2 }} onClick={() => navigate("/tournament")}>
        ← Về Tổng quan giải đấu
      </Button>
    </Box>
  );
}
