import { Button, Stack } from "@mui/material";

export default function TournamentAnimationControls({
  playing = false,
  onStart,
  onSkip,
  onShowNow,
  onReplay,
  canReplay = true,
}) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
      <Button variant="contained" onClick={onStart} disabled={playing}>
        Bắt đầu hiệu ứng
      </Button>
      <Button variant="outlined" onClick={onSkip}>
        Bỏ qua hiệu ứng
      </Button>
      <Button variant="text" onClick={onShowNow}>
        Xem kết quả ngay
      </Button>
      <Button variant="text" onClick={onReplay} disabled={!canReplay || playing}>
        Chạy lại hiệu ứng
      </Button>
    </Stack>
  );
}
