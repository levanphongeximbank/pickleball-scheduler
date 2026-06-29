import { Link as RouterLink } from "react-router-dom";

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

function formatWinRate(wins, losses) {
  const decided = wins + losses;
  if (!decided) {
    return "—";
  }
  return `${Math.round((wins / decided) * 1000) / 10}%`;
}

export default function SeasonStandingsTable({
  rows = [],
  seasonName = "",
  leagueName = "",
  pointsSystem = null,
}) {
  const pointsHint = pointsSystem
    ? `Thắng ${pointsSystem.win} • Hòa ${pointsSystem.draw} • Thua ${pointsSystem.loss}`
    : null;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.25, sm: 1.5 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="h6" fontWeight="bold">
            BXH mùa giải
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {seasonName}
            {leagueName ? ` • ${leagueName}` : ""}
          </Typography>
          {pointsHint ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Cách tính điểm: {pointsHint}
            </Typography>
          ) : null}
        </Box>
        <Chip label={`${rows.length} VĐV`} color="primary" />
      </Stack>

      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Chưa có điểm mùa giải cho bộ lọc này. Nhập kết quả trận trong Giải đấu V3.3 để tích lũy
          điểm.
        </Typography>
      ) : (
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>VĐV</TableCell>
                <TableCell align="right">Điểm</TableCell>
                <TableCell align="right">Trận</TableCell>
                <TableCell align="right">T-B-H</TableCell>
                <TableCell align="right">% thắng</TableCell>
                <TableCell align="right">Elo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow
                  key={row.playerId}
                  hover
                  sx={{
                    bgcolor: index === 0 ? "primary.50" : index < 3 ? "action.hover" : "inherit",
                  }}
                >
                  <TableCell sx={{ fontWeight: index < 3 ? "bold" : "regular" }}>
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <Typography
                      component={RouterLink}
                      to={`/players/profile/${encodeURIComponent(row.playerId)}`}
                      sx={{
                        color: "primary.main",
                        textDecoration: "none",
                        fontWeight: index < 3 ? "bold" : "medium",
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      {row.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    {row.points}
                  </TableCell>
                  <TableCell align="right">{row.matches}</TableCell>
                  <TableCell align="right">
                    {row.wins}-{row.losses}-{row.draws}
                  </TableCell>
                  <TableCell align="right">
                    {formatWinRate(row.wins, row.losses)}
                  </TableCell>
                  <TableCell align="right">
                    {row.rating != null ? row.rating : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
