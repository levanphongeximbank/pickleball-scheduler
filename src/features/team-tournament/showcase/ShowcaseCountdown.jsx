import { Box, Button, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseCountdownSx,
  showcaseSubtitleSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { SHOWCASE_COPY } from "./showcaseConstants.js";

export default function ShowcaseCountdown({
  value,
  paused,
  onPause,
  onResume,
  onSkip,
  canSkip,
}) {
  return (
    <Stack spacing={4} alignItems="center" justifyContent="center" minHeight="70vh">
      <Typography component="h1" sx={showcaseTitleSx}>
        {SHOWCASE_COPY.countdownTitle}
      </Typography>
      <Typography sx={showcaseSubtitleSx}>
        {paused ? "Đã tạm dừng" : "Chuẩn bị trình chiếu"}
      </Typography>
      <Box sx={showcaseCountdownSx} aria-live="polite">
        {value}
      </Box>
      <Box sx={showcaseActionsSx}>
        {paused ? (
          <Button variant="contained" color="success" onClick={onResume}>
            Tiếp tục
          </Button>
        ) : (
          <Button variant="outlined" color="inherit" onClick={onPause}>
            Tạm dừng
          </Button>
        )}
        {canSkip ? (
          <Button variant="text" color="inherit" onClick={onSkip}>
            Bỏ qua (BTC)
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
