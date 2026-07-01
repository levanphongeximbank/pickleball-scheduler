import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";

const STATUS_COLOR = {
  qualified: "success",
  eliminated: "default",
  pending: "warning",
  tie_break_required: "error",
};

export default function EngineRankingTab({ engine }) {
  const { engineState, updateRanking } = engine;
  const ranking = engineState.rankingResult;
  const groupRankings = ranking?.groupRankings || [];

  return (
    <Box>
      <Button
        variant="contained"
        startIcon={<LeaderboardIcon />}
        onClick={updateRanking}
        sx={{ mb: 2 }}
      >
        Cập nhật xếp hạng
      </Button>

      {groupRankings.length === 0 ? (
        <Alert severity="info">Chưa có xếp hạng. Cần bảng và kết quả trận.</Alert>
      ) : (
        groupRankings.map((group) => (
          <Paper key={group.groupId} sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Bảng {group.groupLabel}
            </Typography>
            {group.ties?.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Có {group.ties.length} cặp hòa — cần tie-break hoặc quyết định BTC.
              </Alert>
            )}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Hạng</TableCell>
                  <TableCell>Đội</TableCell>
                  <TableCell align="right">T</TableCell>
                  <TableCell align="right">HS</TableCell>
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.rankings.map((row) => (
                  <TableRow key={row.participantId}>
                    <TableCell>{row.rank}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell align="right">{row.wins}</TableCell>
                    <TableCell align="right">{row.pointDiff}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.qualifiedStatus}
                        color={STATUS_COLOR[row.qualifiedStatus] || "default"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ))
      )}
    </Box>
  );
}
