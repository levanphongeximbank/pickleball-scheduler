import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import {
  showcaseActionsSx,
  showcaseCardSx,
  showcaseSubtitleSx,
  showcaseTitleSx,
} from "./showcaseStyles.js";
import { PROCESSING_STAGES } from "./showcaseConstants.js";

export default function ShowcaseProcessing({
  index,
  paused,
  onPause,
  onResume,
  onCancel,
  canCancel,
}) {
  const label = PROCESSING_STAGES[Math.min(index, PROCESSING_STAGES.length - 1)];
  const progress = ((index + 1) / PROCESSING_STAGES.length) * 100;

  return (
    <Stack spacing={4} alignItems="center" justifyContent="center" minHeight="70vh">
      <Typography component="h1" sx={showcaseTitleSx}>
        AI đang xử lý
      </Typography>
      <Typography sx={showcaseSubtitleSx}>
        Kết quả đã được chốt — đang trình bày tiến trình
      </Typography>
      <Box sx={{ ...showcaseCardSx, width: "100%", maxWidth: 720 }}>
        <Typography fontSize="1.35rem" fontWeight={700} mb={2}>
          {label}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 10,
            borderRadius: 1,
            bgcolor: "rgba(255,255,255,0.08)",
            "& .MuiLinearProgress-bar": { bgcolor: "#7CFFB2" },
          }}
        />
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
        {canCancel ? (
          <Button variant="text" color="inherit" onClick={onCancel}>
            Hủy trước khi công bố đội
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}
