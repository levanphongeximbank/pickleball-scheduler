import {
  Alert,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

export default function EngineSetupTab({ engine, tournamentId }) {
  const { tournament, context, engineState, runFullPlan, applyToTournament, saveConfig, players, matches } = engine;

  const handleSaveConfig = () => {
    saveConfig({
      groupCount: Number(document.getElementById("engine-group-count")?.value) || 4,
      scheduleConfig: {
        ...(engineState.scheduleConfig || {}),
        startTime: document.getElementById("engine-start-time")?.value || "08:00",
        endTime: document.getElementById("engine-end-time")?.value || "22:00",
        averageMatchMinutes: Number(document.getElementById("engine-match-minutes")?.value) || 25,
        bufferMinutes: Number(document.getElementById("engine-buffer")?.value) || 5,
      },
    });
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Tournament Engine 4.0 — lớp xử lý mới, không thay luồng tạo giải cũ. Cấu hình tại đây rồi
        áp dụng vào giải khi sẵn sàng.
      </Alert>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Thiết lập giải
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              id="engine-group-count"
              label="Số bảng"
              type="number"
              fullWidth
              defaultValue={engineState.groupCount ?? context?.groupCount ?? 4}
              inputProps={{ min: 1, max: 12 }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              id="engine-start-time"
              label="Giờ bắt đầu"
              fullWidth
              defaultValue={context?.scheduleConfig?.startTime || "08:00"}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              id="engine-end-time"
              label="Giờ kết thúc"
              fullWidth
              defaultValue={context?.scheduleConfig?.endTime || "22:00"}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              id="engine-match-minutes"
              label="Phút/trận (TB)"
              type="number"
              fullWidth
              defaultValue={context?.scheduleConfig?.averageMatchMinutes ?? 25}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              id="engine-buffer"
              label="Buffer (phút)"
              type="number"
              fullWidth
              defaultValue={context?.scheduleConfig?.bufferMinutes ?? 5}
            />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Chip label={`${context?.participants?.length ?? 0} VĐV/đội`} />
          <Chip label={`${context?.courts?.length ?? 0} sân`} />
          <Chip label={tournament?.mode || "—"} variant="outlined" />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSaveConfig}>
            Lưu cấu hình
          </Button>
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={runFullPlan}>
            Chạy pipeline đầy đủ
          </Button>
          <Button variant="contained" color="secondary" onClick={applyToTournament}>
            Áp dụng vào giải
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <AutoAwesomeIcon color="primary" />
          <Typography variant="subtitle2" color="text.secondary">
            Platform workflow status
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Tạo hạt giống → Bốc thăm thông minh → Tạo lịch đấu → Xếp sân → Dự đoán thời gian → Cập nhật
          xếp hạng
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`VĐV: ${players?.length || 0}`} size="small" color="primary" variant="outlined" />
          <Chip label={`Sân: ${context?.courts?.length || 0}`} size="small" color="secondary" variant="outlined" />
          <Chip label={`Trận: ${matches?.length || 0}`} size="small" variant="outlined" />
          <Chip label={`Engine state: ${engineState?.seedResult ? "ready" : "draft"}`} size="small" variant="outlined" />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          ID giải: {tournamentId}
        </Typography>
      </Paper>
    </Stack>
  );
}
