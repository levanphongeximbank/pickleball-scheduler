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
import ScheduleIcon from "@mui/icons-material/Schedule";
import TimerIcon from "@mui/icons-material/Timer";

export default function EngineScheduleTab({ engine }) {
  const { engineState, generateSchedule, predictTime } = engine;
  const schedule = engineState.scheduleResult;
  const matches = schedule?.matches || engineState.matches || [];
  const time = engineState.timeResult;

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <Button variant="contained" startIcon={<ScheduleIcon />} onClick={() => generateSchedule(false)}>
          Tạo lịch đấu
        </Button>
        <Button variant="outlined" onClick={() => generateSchedule(true)}>
          Tạo lại lịch
        </Button>
        <Button variant="outlined" startIcon={<TimerIcon />} onClick={predictTime}>
          Dự đoán thời gian
        </Button>
        <Chip label={`Trận: ${matches.length}`} size="small" variant="outlined" />
      </Stack>

      {time && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Dự kiến kết thúc ~{time.estimatedFinishTime} ({time.totalTournamentEstimatedTime} phút với
          sân hiện có)
        </Alert>
      )}

      {matches.length === 0 ? (
        <Alert severity="info">Chưa có lịch. Chạy bốc thăm trước.</Alert>
      ) : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Trận</TableCell>
                <TableCell>Slot</TableCell>
                <TableCell>Bắt đầu</TableCell>
                <TableCell>Sân</TableCell>
                <TableCell>Trạng thái</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matches.slice(0, 50).map((match) => (
                <TableRow key={match.id}>
                  <TableCell>{match.id}</TableCell>
                  <TableCell>{match.slot ?? "—"}</TableCell>
                  <TableCell>
                    {match.scheduledStart
                      ? new Date(match.scheduledStart).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>{match.courtId ?? "—"}</TableCell>
                  <TableCell>{match.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {matches.length > 50 && (
            <Typography variant="caption" sx={{ p: 1, display: "block" }}>
              … và {matches.length - 50} trận khác
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  );
}
