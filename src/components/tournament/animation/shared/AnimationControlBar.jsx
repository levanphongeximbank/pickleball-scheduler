import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

import { ANIMATION_SPEEDS, VISUAL_MODES } from "../animationConfig.js";

export const ANIMATION_CONTROL_MODES = {
  MANUAL: "manual",
  AUTO: "auto",
};

export default function AnimationControlBar({
  playing = false,
  paused = false,
  controlMode = ANIMATION_CONTROL_MODES.AUTO,
  speed = "normal",
  visualMode,
  showVisualMode = false,
  isComplete = false,
  canReveal = true,
  waitingGroupAdvance = false,
  nextGroupLabel,
  startButtonLabel = "Bắt đầu",
  onStart,
  onRevealNext,
  onStartAuto,
  onPause,
  onResume,
  onSkip,
  onReplay,
  onViewResults,
  onSpeedChange,
  onControlModeChange,
  onVisualModeChange,
  onNextGroup,
  onViewSchedule,
  soundEnabled = false,
  onSoundToggle,
  showDismissHint = false,
}) {
  const isManual = controlMode === ANIMATION_CONTROL_MODES.MANUAL;

  return (
    <Box className="tournament-control-bar">
      <Stack spacing={1.25}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 130, flex: 1 }}>
            <InputLabel>Chế độ</InputLabel>
            <Select
              label="Chế độ"
              value={controlMode}
              onChange={(event) => onControlModeChange?.(event.target.value)}
            >
              <MenuItem value={ANIMATION_CONTROL_MODES.MANUAL}>Từng bước</MenuItem>
              <MenuItem value={ANIMATION_CONTROL_MODES.AUTO}>Auto</MenuItem>
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
          {showVisualMode ? (
            <FormControl size="small" sx={{ minWidth: 150, flex: 1 }}>
              <InputLabel>Hiệu ứng</InputLabel>
              <Select
                label="Hiệu ứng"
                value={visualMode || VISUAL_MODES.PROFESSIONAL}
                onChange={(event) => onVisualModeChange?.(event.target.value)}
              >
                <MenuItem value={VISUAL_MODES.PROFESSIONAL}>Professional</MenuItem>
                <MenuItem value={VISUAL_MODES.CEREMONY}>Ceremony</MenuItem>
                <MenuItem value={VISUAL_MODES.CLASSIC}>Classic (vòng quay)</MenuItem>
              </Select>
            </FormControl>
          ) : null}
          {onSoundToggle ? (
            <FormControlLabel
              control={<Switch size="small" checked={soundEnabled} onChange={(event) => onSoundToggle(event.target.checked)} />}
              label="Âm thanh"
              sx={{ ml: 0 }}
            />
          ) : null}
        </Stack>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {isManual ? (
            <Button
              variant="contained"
              onClick={onRevealNext}
              disabled={!canReveal || isComplete || (playing && !paused)}
            >
              Từng bước
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={onStartAuto || onStart}
              disabled={isComplete || (playing && !paused) || paused}
            >
              {startButtonLabel}
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

          <Button variant="outlined" color="inherit" onClick={onSkip} disabled={isComplete}>
            Bỏ qua hiệu ứng
          </Button>
          <Button variant="text" onClick={onViewResults || onSkip}>
            Xem kết quả ngay
          </Button>
          <Button variant="text" onClick={onReplay} disabled={playing}>
            Chạy lại hiệu ứng
          </Button>

          {waitingGroupAdvance && nextGroupLabel ? (
            <Button variant="contained" color="success" onClick={onNextGroup}>
              Sang Bảng {nextGroupLabel}
            </Button>
          ) : null}

          {isComplete && onViewSchedule ? (
            <Button variant="contained" color="success" onClick={onViewSchedule}>
              Xem lịch thi đấu
            </Button>
          ) : null}
        </Box>

        {showDismissHint ? (
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            Bấm ra ngoài màn hình để thoát
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
