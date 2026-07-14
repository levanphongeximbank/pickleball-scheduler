import { useMemo } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { getTournament } from "../../domain/tournamentService.js";
import { isDrawPublished } from "../../tournament/engines/publishDrawEngine.js";
import { isSchedulePublished } from "../../tournament/engines/publishScheduleEngine.js";
import { buildFinalRanking } from "../../features/individual-tournament/engines/awardsEngine.js";
import { getLiveStandings } from "../../features/individual-tournament/engines/resultPropagationEngine.js";
import { buildIndividualAllGroupStandings } from "../../features/individual-tournament/adapters/individualStandingsAdapter.js";
import {
  TournamentEmptyState,
  TournamentErrorState,
} from "../../components/tournament/TournamentUiState.jsx";
import { MOBILE_PAGE_GUTTER, touchButtonSx, horizontalScrollSx } from "../../components/tournament/mobileUi.js";
import { useIsMobile } from "../../features/mobile/hooks/useIsMobile.js";

/**
 * S1-H — Public read-only spectator view (post draw/schedule publish).
 */
export default function IndividualTournamentPublicPage() {
  const { tournamentId } = useParams();
  const { activeClubId, revision } = useClub();
  const isMobile = useIsMobile();

  const tournament = useMemo(() => {
    if (!tournamentId || !activeClubId) return null;
    return getTournament(activeClubId, tournamentId);
  }, [activeClubId, tournamentId, revision]);

  if (!tournamentId) {
    return <TournamentErrorState title="Thiếu mã giải" />;
  }

  if (!tournament) {
    return (
      <Box sx={{ p: 3 }}>
        <TournamentErrorState title="Không tìm thấy giải công khai" />
      </Box>
    );
  }

  const drawOk = isDrawPublished(tournament);
  const scheduleOk = isSchedulePublished(tournament);
  const event = tournament.events?.[0];
  const live = getLiveStandings(tournament, event?.id);
  const groups =
    live?.groups ||
    (event ? buildIndividualAllGroupStandings(event, { forceCanonical: false }) : []);
  const ranking = buildFinalRanking(tournament, event?.id).ranking || [];

  return (
    <Box sx={{ px: isMobile ? MOBILE_PAGE_GUTTER : 3, py: 3, pb: 8, maxWidth: 960, mx: "auto" }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="h4" fontWeight={800}>
              {tournament.name}
            </Typography>
            <Typography color="text.secondary">Trang công khai (chỉ xem)</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={tournament.status} />
              <Chip
                size="small"
                color={drawOk ? "success" : "default"}
                label={drawOk ? "Đã công bố bốc thăm" : "Chưa công bố bốc thăm"}
              />
              <Chip
                size="small"
                color={scheduleOk ? "success" : "default"}
                label={scheduleOk ? "Đã công bố lịch" : "Chưa công bố lịch"}
              />
            </Stack>
          </Box>
          <Button
            component={RouterLink}
            to={`/tournament/my/${tournamentId}`}
            variant="outlined"
            sx={touchButtonSx}
          >
            Cổng VĐV
          </Button>
        </Stack>

        {!drawOk ? (
          <Alert severity="info">
            BTC chưa công bố bốc thăm — BXH/nhánh công khai còn hạn chế.
          </Alert>
        ) : null}

        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>
            Bảng xếp hạng
          </Typography>
          {(groups || []).length === 0 ? (
            <TournamentEmptyState title="Chưa có BXH" />
          ) : (
            (groups || []).map((group) => (
              <Box key={group.groupId || group.group} sx={{ mb: 2, ...horizontalScrollSx }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Bảng {group.groupId || group.group}
                </Typography>
                <Table size="small" aria-label={`Bảng xếp hạng ${group.groupId || group.group}`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>VĐV / Cặp</TableCell>
                      <TableCell align="center">W</TableCell>
                      <TableCell align="center">L</TableCell>
                      <TableCell align="center">Điểm</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(group.standing || []).map((row, index) => (
                      <TableRow key={row.id || row.entryId || index}>
                        <TableCell>{row.rank ?? index + 1}</TableCell>
                        <TableCell>{row.name || row.id}</TableCell>
                        <TableCell align="center">{row.won ?? "—"}</TableCell>
                        <TableCell align="center">{row.lost ?? "—"}</TableCell>
                        <TableCell align="center">{row.matchPoints ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))
          )}
        </Paper>

        {ranking.length > 0 ? (
          <Paper sx={{ p: 2 }}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>
              Podium
            </Typography>
            {ranking.map((row) => (
              <Typography key={row.entryId} variant="body2">
                #{row.rank} {row.name} {row.medal ? `(${row.medal})` : ""}
              </Typography>
            ))}
          </Paper>
        ) : null}

        {event?.bracket?.rounds?.length ? (
          <Alert severity="success">
            Nhánh knockout đã sẵn sàng ({event.bracket.rounds.length} vòng). Mở trang bracket nội bộ
            để xem cây đầy đủ.
          </Alert>
        ) : null}
      </Stack>
    </Box>
  );
}
