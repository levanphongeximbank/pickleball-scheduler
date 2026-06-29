import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from "@mui/material";

import { ANIMATION_SPEEDS } from "../animation/animationConfig.js";
import { BRACKET_CONTROL_MODES } from "./useBracketSequence.js";

export default function BracketControlBar({
  playing = false,
  paused = false,
  controlMode = BRACKET_CONTROL_MODES.AUTO,
  speed = "normal",
  isComplete = false,
  onStart,
  onRevealNext,
  onPause,
  onResume,
  onReplay,
  onSkip,
  onSpeedChange,
  onControlModeChange,
}) {
  const isStep = controlMode === BRACKET_CONTROL_MODES.STEP;

  return (
    <Box className="tournament-control-bar tournament-bracket-control-bar">
      <Stack spacing={1.25}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 130, flex: 1 }}>
            <InputLabel>Chế độ</InputLabel>
            <Select
              label="Chế độ"
              value={controlMode}
              onChange={(event) => onControlModeChange?.(event.target.value)}
            >
              <MenuItem value={BRACKET_CONTROL_MODES.AUTO}>Auto</MenuItem>
              <MenuItem value={BRACKET_CONTROL_MODES.STEP}>Từng bước</MenuItem>
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
          {isStep ? (
            <Button variant="contained" onClick={onRevealNext} disabled={isComplete || (playing && !paused)}>
              Từng bước
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={onStart}
              disabled={isComplete || (playing && !paused) || paused}
            >
              Chạy hiệu ứng
            </Button>
          )}

          {paused ? (
            <Button variant="outlined" onClick={onResume}>
              Tiếp tục
            </Button>
          ) : (
            <Button variant="outlined" onClick={onPause} disabled={!playing}>
              Tạm dừng
            </Button>
          )}

          <Button variant="outlined" onClick={onReplay}>
            Chạy lại
          </Button>
          <Button variant="outlined" color="inherit" onClick={onSkip}>
            Bỏ qua hiệu ứng
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
