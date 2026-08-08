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
import { TOURNAMENT_STATUS } from "../../../models/tournament/index.js";
import TournamentPageHeader from "../../../components/tournament/TournamentPageHeader.jsx";
import TournamentSectionCard from "../../../components/tournament/TournamentSectionCard.jsx";
import { TournamentStatusChip } from "../../../components/tournament/TournamentStatusChip.jsx";
import {
  tournamentTableCellSx,
  tournamentTableHeadSx,
} from "../../../components/tournament/tournamentLayout.js";
import { useCanonicalTournamentList } from "../hooks/useCanonicalTournament.js";

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
 * Canonical picker — reads only via tournamentQueries (no direct blob/localStorage).
 */
export default function CanonicalTournamentPicker({
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

  const { tournaments, loading } = useCanonicalTournamentList(activeClubId, revision);

  const matches = useMemo(
    () =>
      rankTournaments(tournaments.filter(filter), {
        seasonId: activeSeason?.id,
        leagueId: activeLeague?.id,
      }),
    [tournaments, filter, activeSeason?.id, activeLeague?.id]
  );

  useEffect(() => {
    if (loading || !autoNavigateSingle || matches.length !== 1) return;
    const path = resolvePath(matches[0]);
    if (path) {
      navigate(path, { replace: true });
    }
  }, [autoNavigateSingle, loading, matches, navigate, resolvePath]);

  if (!loading && autoNavigateSingle && matches.length === 1) {
    return null;
  }

  return (
    <Box>
      <TournamentPageHeader title={title} description={description} />

      {loading ? (
        <Alert severity="info">Đang tải danh sách giải…</Alert>
      ) : matches.length === 0 ? (
        <Alert severity="info">{emptyHint || "Chưa có giải phù hợp."}</Alert>
      ) : (
        <TournamentSectionCard title="Chọn giải">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={tournamentTableHeadSx}>Tên giải</TableCell>
                  <TableCell sx={tournamentTableHeadSx}>Loại</TableCell>
                  <TableCell sx={tournamentTableHeadSx}>Trạng thái</TableCell>
                  <TableCell sx={tournamentTableHeadSx} align="right">
                    Thao tác
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {matches.map((tournament) => (
                  <TableRow key={tournament.id} hover>
                    <TableCell sx={tournamentTableCellSx}>
                      <Typography fontWeight={600}>{tournament.name}</Typography>
                    </TableCell>
                    <TableCell sx={tournamentTableCellSx}>
                      {tournament.modeLabel || tournament.mode}
                    </TableCell>
                    <TableCell sx={tournamentTableCellSx}>
                      <TournamentStatusChip status={tournament.status} />
                    </TableCell>
                    <TableCell sx={tournamentTableCellSx} align="right">
                      <Button
                        size="small"
                        endIcon={<ChevronRightIcon />}
                        onClick={() => navigate(resolvePath(tournament))}
                      >
                        Mở
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TournamentSectionCard>
      )}
    </Box>
  );
}
