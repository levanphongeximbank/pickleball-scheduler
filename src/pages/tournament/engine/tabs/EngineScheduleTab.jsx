import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";

import ScheduleBuilderPanel from "../../../../components/tournament/ScheduleBuilderPanel.jsx";

export default function EngineScheduleTab({ engine }) {
  const {
    tournament,
    engineState,
    courts,
    schedulePublish,
    hasReopenPermission,
    generateSchedule,
    predictTime,
    lockSchedulePublish,
    publishScheduleResult,
    reopenSchedulePublish,
    forceRepublish,
    updateScheduleMatches,
    saveConfig,
  } = engine;

  const schedule = engineState.scheduleResult;
  const matches = schedule?.matches || engineState.matches || [];
  const time = engineState.timeResult;
  const minRestMinutes =
    tournament?.settings?.schedule?.minRestMinutes ??
    engineState?.scheduleConfig?.minRestMinutes ??
    contextMinRest(engine) ??
    15;

  const entryLabels = {};
  (engineState?.seedResult?.participants || []).forEach((p) => {
    entryLabels[p.id] = p.name || p.id;
  });

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField
          size="small"
          type="number"
          label="Nghỉ tối thiểu (phút)"
          value={minRestMinutes}
          onChange={(e) => {
            const value = Math.max(0, Number(e.target.value) || 0);
            saveConfig?.({
              scheduleConfig: {
                ...(engineState.scheduleConfig || {}),
                minRestMinutes: value,
              },
            });
            if (tournament) {
              // persisted via mergeEngineState; also stash on schedule settings
            }
          }}
          sx={{ width: 180 }}
          inputProps={{ min: 0 }}
        />
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

      {!tournament ? (
        <Alert severity="warning">Chọn giải để lập và công bố lịch.</Alert>
      ) : (
        <ScheduleBuilderPanel
          tournament={tournament}
          matches={matches}
          courts={courts}
          minRestMinutes={minRestMinutes}
          schedulePublish={schedulePublish}
          hasReopenPermission={hasReopenPermission}
          onGenerate={() => generateSchedule(false)}
          onRegenerate={() => generateSchedule(true)}
          onLock={lockSchedulePublish}
          onPublish={publishScheduleResult}
          onReopen={reopenSchedulePublish}
          onForceRepublish={forceRepublish}
          onMatchesChange={(next) => updateScheduleMatches(next)}
          entryLabels={entryLabels}
        />
      )}

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        Lịch chỉ công bố sau khi bốc thăm đã publish. Snapshot bất biến đến khi Owner/Super Admin mở lại.
      </Typography>
    </Box>
  );
}

function contextMinRest(engine) {
  return engine?.context?.scheduleConfig?.minRestMinutes;
}
