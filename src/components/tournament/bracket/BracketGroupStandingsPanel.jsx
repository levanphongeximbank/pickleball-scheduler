import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
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

import { tournamentTableCellSx, tournamentTableHeadSx } from "../tournamentLayout.js";

function resolveGroupCourtLabel(groupId, matches = [], courts = []) {
  const groupMatch = (matches || []).find(
    (match) => String(match.groupId) === String(groupId) && match.courtId
  );
  if (!groupMatch?.courtId) {
    return "";
  }
  const court = courts.find((item) => String(item.id) === String(groupMatch.courtId));
  return court?.name || `Sân ${groupMatch.courtId}`;
}

function GroupStandingCard({ groupStanding, courts = [], matches = [] }) {
  const courtLabel = resolveGroupCourtLabel(groupStanding.groupId, matches, courts);
  const teamCount = groupStanding.standing.length;

  return (
    <Paper variant="outlined" className="tournament-group-standing-card">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        className="tournament-group-standing-card__header"
        spacing={1}
      >
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <Typography className="tournament-group-standing-card__title">
            BẢNG {String(groupStanding.group || "").toUpperCase()}
          </Typography>
          {courtLabel ? (
            <Chip size="small" label={courtLabel} className="tournament-group-standing-card__court" />
          ) : null}
        </Stack>
        <Typography variant="caption" className="tournament-group-standing-card__teams">
          {teamCount} ĐỘI
        </Typography>
      </Stack>

      <TableContainer>
        <Table size="small" className="tournament-group-standing-card__table">
          <TableHead>
            <TableRow>
              {["#", "Đội / Cặp", "Thắng", "Thua", "Ghi", "Bị", "±"].map((label) => (
                <TableCell
                  key={label}
                  sx={tournamentTableHeadSx}
                  align={label === "Đội / Cặp" ? "left" : "center"}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {groupStanding.standing.map((team, index) => {
              const diff = Number(team.scoreDiff) || 0;
              const rankClass =
                index === 0
                  ? "tournament-group-standing-card__rank--first"
                  : index === 1
                    ? "tournament-group-standing-card__rank--second"
                    : "";

              return (
                <TableRow key={team.id} hover>
                  <TableCell align="center" sx={{ ...tournamentTableCellSx, width: 40 }}>
                    <Box className={`tournament-group-standing-card__rank ${rankClass}`}>
                      {index + 1}
                    </Box>
                  </TableCell>
                  <TableCell sx={tournamentTableCellSx}>
                    <Typography variant="body2" fontWeight={index < 2 ? 700 : 500}>
                      {team.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={tournamentTableCellSx}>
                    <Typography
                      variant="body2"
                      fontWeight={team.won > 0 ? 700 : 500}
                      className={team.won > 0 ? "tournament-group-standing-card__wins" : ""}
                    >
                      {team.won}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={tournamentTableCellSx}>
                    {team.lost}
                  </TableCell>
                  <TableCell align="center" sx={tournamentTableCellSx}>
                    {team.pointsFor}
                  </TableCell>
                  <TableCell align="center" sx={tournamentTableCellSx}>
                    {team.pointsAgainst}
                  </TableCell>
                  <TableCell align="center" sx={tournamentTableCellSx}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      className={
                        diff > 0
                          ? "tournament-group-standing-card__diff--pos"
                          : diff < 0
                            ? "tournament-group-standing-card__diff--neg"
                            : ""
                      }
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        className="tournament-group-standing-card__footer"
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <SportsTennisIcon sx={{ fontSize: 16, color: "var(--bracket-primary)" }} />
          <Typography variant="caption" fontWeight={600}>
            {groupStanding.matchCount} TRẬN
          </Typography>
        </Stack>
        <ExpandMoreIcon sx={{ fontSize: 18, color: "text.secondary" }} />
      </Stack>
    </Paper>
  );
}

export default function BracketGroupStandingsPanel({
  standings = [],
  courts = [],
  event = null,
}) {
  if (!standings.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Chưa có kết quả vòng bảng.
      </Typography>
    );
  }

  const matches = event?.matches || [];

  return (
    <Box className="tournament-group-standings" sx={{ mb: 3 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.25 }}>
        BXH vòng bảng
      </Typography>
      <Stack spacing={2}>
        {standings.map((groupStanding) => (
          <GroupStandingCard
            key={groupStanding.groupId || groupStanding.group}
            groupStanding={groupStanding}
            courts={courts}
            matches={matches}
          />
        ))}
      </Stack>
    </Box>
  );
}
