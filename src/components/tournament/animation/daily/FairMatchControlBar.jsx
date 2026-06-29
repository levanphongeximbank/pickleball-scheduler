import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { ANIMATION_SPEEDS } from "../animationConfig.js";
import { FAIR_MATCH_CONTROL_MODES } from "./useFairMatchSequence.js";

export default function FairMatchControlBar({
  playing = false,
  paused = false,
  controlMode = FAIR_MATCH_CONTROL_MODES.AUTO,
  speed = "normal",
  isComplete = false,
  canReveal = true,
  onPause,
  onResume,
  onRevealNext,
  onStartAuto,
  onSkip,
  onReplay,
  onViewResults,
  onSpeedChange,
  onControlModeChange,
  showDismissHint = false,
}) {
  const isManual = controlMode === FAIR_MATCH_CONTROL_MODES.MANUAL;

  return (
    <Box className="daily-fair-control-bar">
      <Stack spacing={1.25}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 130, flex: 1 }}>
            <InputLabel>Chế độ</InputLabel>
            <Select
              label="Chế độ"
              value={controlMode}
              onChange={(event) => onControlModeChange?.(event.target.value)}
            >
              <MenuItem value={FAIR_MATCH_CONTROL_MODES.MANUAL}>Manual</MenuItem>
              <MenuItem value={FAIR_MATCH_CONTROL_MODES.AUTO}>Auto</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130, flex: 1 }}>
            <InputLabel>Tốc độ</InputLabel>
            <Select label="Tốc độ" value={speed} onChange={(event) => onSpeedChange?.(event.target.value)}>
              {Object.values(ANIMATION_SPEEDS).map((item) => (
                <MenuItem key={item.key} value={item.key}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {isManual ? (
            <Button variant="contained" onClick={onRevealNext} disabled={!canReveal || isComplete}>
              Tạo trận
            </Button>
          ) : (
            <Button variant="contained" onClick={onStartAuto} disabled={playing || isComplete}>
              Auto
            </Button>
          )}

          {paused ? (
            <Button variant="outlined" onClick={onResume}>
              Tiếp tục
            </Button>
          ) : (
            <Button variant="outlined" onClick={onPause} disabled={!playing}>
              Pause
            </Button>
          )}

          <Button variant="outlined" color="inherit" onClick={onSkip} disabled={isComplete}>
            Skip
          </Button>
          <Button variant="text" onClick={onReplay} disabled={playing}>
            Replay
          </Button>
          <Button variant="text" onClick={onViewResults}>
            Kết quả ngay
          </Button>
        </Box>

        {showDismissHint && (
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            Bấm ra ngoài màn hình để thoát
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
