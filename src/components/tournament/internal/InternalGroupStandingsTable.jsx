import {
  Alert,
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

/**
 * Shared Internal live group standings table (IT-E2E-BROWSER-019).
 * Read-only. Same projection for organizer and referee.
 */
export default function InternalGroupStandingsTable({
  projection = null,
  compact = false,
  title = "BẢNG XẾP HẠNG VÒNG BẢNG",
} = {}) {
  const groups = projection?.groups || [];
  if (!projection?.visible || !groups.length) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5 }} data-testid="internal-live-group-standings-empty">
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Chưa có bảng để tính xếp hạng.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: compact ? 1.25 : 1.5 }}
      data-testid="internal-live-group-standings"
      data-final={projection.final ? "yes" : "no"}
      data-row-identity={projection.rowIdentity}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 1 }}
      >
        <Typography variant={compact ? "subtitle2" : "subtitle1"} fontWeight="bold">
          {title}
        </Typography>
        <Chip
          size="small"
          color={projection.final ? "success" : "default"}
          label={projection.final ? "BXH chốt vòng bảng" : "BXH đang cập nhật"}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25 }}>
        Tie-break: {projection.tieBreakRule}
        {projection.final ? "" : " · Chưa phải BXH cuối"}
      </Typography>
      <Stack spacing={1.5}>
        {groups.map((groupStanding) => (
          <Paper key={groupStanding.groupId || groupStanding.group} variant="outlined" sx={{ overflow: "auto" }}>
            <Typography fontWeight="bold" sx={{ px: 1.25, pt: 1 }}>
              Bảng {groupStanding.group}
            </Typography>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Hạng</TableCell>
                  <TableCell>Đội</TableCell>
                  <TableCell align="right">Trận</TableCell>
                  <TableCell align="right">Thắng</TableCell>
                  <TableCell align="right">Thua</TableCell>
                  <TableCell align="right">Điểm</TableCell>
                  {!compact ? <TableCell align="right">Điểm ghi</TableCell> : null}
                  {!compact ? <TableCell align="right">Điểm thua</TableCell> : null}
                  <TableCell align="right">Hiệu số</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groupStanding.standing.map((row) => (
                  <TableRow key={row.id} data-testid={`internal-standing-row-${row.id}`}>
                    <TableCell>{row.rank}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{row.name}</TableCell>
                    <TableCell align="right">{row.played}</TableCell>
                    <TableCell align="right">{row.won}</TableCell>
                    <TableCell align="right">{row.lost}</TableCell>
                    <TableCell align="right">{row.matchPoints}</TableCell>
                    {!compact ? <TableCell align="right">{row.pointsFor}</TableCell> : null}
                    {!compact ? <TableCell align="right">{row.pointsAgainst}</TableCell> : null}
                    <TableCell align="right">{row.scoreDiff}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ))}
      </Stack>
      {projection.knockout?.reason && !projection.knockout.enabled ? (
        <Alert severity="info" sx={{ mt: 1.25 }}>
          {projection.knockout.reason}
        </Alert>
      ) : null}
    </Paper>
  );
}
