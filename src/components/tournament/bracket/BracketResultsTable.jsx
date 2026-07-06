import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { resolveMatchResultLabel, resolveMatchResultTone } from "./bracketScreenUtils.js";
import { tournamentTableCellSx, tournamentTableHeadSx } from "../tournamentLayout.js";

const KO_COLUMNS = [
  "Mã trận",
  "Đội A",
  "Điểm",
  "Đội B",
  "Điểm",
  "Sân",
  "Thời gian",
  "Kết quả",
];

function ResultChip({ match }) {
  const label = resolveMatchResultLabel(match);
  const tone = resolveMatchResultTone(match);

  return (
    <Chip
      size="small"
      label={label}
      className={`tournament-bracket-results-chip tournament-bracket-results-chip--${tone}`}
    />
  );
}

function MobileMatchCard({ match }) {
  const scoreA = match.home.score !== "" && match.home.score != null ? match.home.score : "—";
  const scoreB = match.away.score !== "" && match.away.score != null ? match.away.score : "—";

  return (
    <Paper variant="outlined" className="tournament-bracket-results-mobile-card">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          {match.code} · {match.roundDisplay}
        </Typography>
        <ResultChip match={match} />
      </Stack>
      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography
            variant="body2"
            fontWeight={match.home.isWinner ? 700 : 500}
            className={match.home.isWinner ? "tournament-bracket-results-winner" : ""}
            sx={{ flex: 1, pr: 1 }}
          >
            {match.home.name}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {scoreA}
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography
            variant="body2"
            fontWeight={match.away.isWinner ? 700 : 500}
            className={match.away.isWinner ? "tournament-bracket-results-winner" : ""}
            sx={{ flex: 1, pr: 1 }}
          >
            {match.away.name}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {scoreB}
          </Typography>
        </Stack>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        {match.courtLabel}
        {match.scheduleText ? ` · ${match.scheduleText}` : ""}
      </Typography>
    </Paper>
  );
}

function KnockoutRoundSection({ round, desktop = true }) {
  if (!round?.matches?.length) {
    return null;
  }

  const pillLabel = `${round.displayName.toUpperCase()} • ${round.matches.length} TRẬN`;

  return (
    <Box className="tournament-bracket-results-round" sx={{ mb: 2.5 }}>
      <Box className="tournament-bracket-round-pill tournament-bracket-round-pill--section">
        {pillLabel}
      </Box>

      {desktop ? (
        <TableContainer component={Paper} variant="outlined" className="tournament-bracket-results-table">
          <Table size="small">
            <TableHead>
              <TableRow>
                {KO_COLUMNS.map((label) => (
                  <TableCell key={label} sx={tournamentTableHeadSx}>
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {round.matches.map((match) => (
                <TableRow key={match.id} hover>
                  <TableCell sx={tournamentTableCellSx}>{match.code}</TableCell>
                  <TableCell sx={tournamentTableCellSx}>
                    <Typography
                      variant="body2"
                      fontWeight={match.home.isWinner ? 700 : 500}
                      className={match.home.isWinner ? "tournament-bracket-results-winner" : ""}
                    >
                      {match.home.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={tournamentTableCellSx} align="center">
                    <Typography
                      variant="body2"
                      fontWeight={match.home.isWinner ? 700 : 500}
                      className={match.home.isWinner ? "tournament-bracket-results-winner" : ""}
                    >
                      {match.home.score !== "" && match.home.score != null ? match.home.score : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={tournamentTableCellSx}>
                    <Typography
                      variant="body2"
                      fontWeight={match.away.isWinner ? 700 : 500}
                      className={match.away.isWinner ? "tournament-bracket-results-winner" : ""}
                    >
                      {match.away.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={tournamentTableCellSx} align="center">
                    <Typography
                      variant="body2"
                      fontWeight={match.away.isWinner ? 700 : 500}
                      className={match.away.isWinner ? "tournament-bracket-results-winner" : ""}
                    >
                      {match.away.score !== "" && match.away.score != null ? match.away.score : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={tournamentTableCellSx}>{match.courtLabel}</TableCell>
                  <TableCell sx={tournamentTableCellSx}>
                    {match.scheduleText || "Chưa xếp"}
                  </TableCell>
                  <TableCell sx={tournamentTableCellSx}>
                    <ResultChip match={match} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Stack spacing={1}>
          {round.matches.map((match) => (
            <MobileMatchCard key={match.id} match={match} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default function BracketResultsTable({ viewModel, desktop = true }) {
  const rounds = viewModel?.rounds || [];

  if (!rounds.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Chưa có trận knock-out.
      </Typography>
    );
  }

  return (
    <Box className="tournament-bracket-knockout-results">
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        Loại trực tiếp
      </Typography>
      {rounds.map((round) => (
        <KnockoutRoundSection key={round.key} round={round} desktop={desktop} />
      ))}
    </Box>
  );
}
