import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

import {
  projectInternalAwardsWorkspace,
  resolveInternalCompletionAction,
} from "../../../features/tournament/internal/internalAwardsWorkspace.js";

export default function InternalAwardsWorkspace({
  tournament,
  confirming = false,
  completing = false,
  onConfirmAwards,
  onCompleteTournament,
}) {
  const projection = projectInternalAwardsWorkspace(tournament);
  const completion = resolveInternalCompletionAction(tournament);
  const championName = projection.champion?.name || "Chưa xác định";
  const runnerUpName = projection.runnerUp?.name || "Chưa xác định";

  return (
    <Stack spacing={2} sx={{ mt: 2 }} data-testid="internal-awards-workspace">
      <Typography variant="h6" fontWeight={800}>
        TRAO GIẢI
      </Typography>

      {!projection.derivedReady ? (
        <Alert severity="info">
          Chưa có nhà vô địch và á quân. Hoàn tất trận chung kết (hoặc vòng bảng nếu giải 1 bảng)
          rồi quay lại đây.
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2 }} data-testid="internal-awards-podium">
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <EmojiEventsIcon color="warning" />
          <Typography fontWeight={700}>Podium</Typography>
          <Chip size="small" label={projection.rowIdentity} />
        </Stack>
        <Typography variant="body1" data-testid="internal-awards-champion">
          Nhà vô địch: {championName}
        </Typography>
        <Typography variant="body1" data-testid="internal-awards-runner-up">
          Á quân: {runnerUpName}
        </Typography>
      </Paper>

      {projection.awardsReady ? (
        <Alert severity="success">Đã xác nhận trao giải. Có thể hoàn tất giải.</Alert>
      ) : (
        <Alert severity="warning">
          Xác nhận nhà vô địch và á quân trước khi bấm Hoàn tất.
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button
          variant="contained"
          disabled={!projection.derivedReady || projection.awardsReady || confirming}
          onClick={() => onConfirmAwards?.()}
          data-testid="internal-awards-confirm"
        >
          {projection.awardsReady ? "Đã xác nhận trao giải" : "Xác nhận trao giải"}
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={!completion.enabled || completing}
          onClick={() => onCompleteTournament?.()}
          data-testid="internal-awards-complete"
        >
          Hoàn tất
        </Button>
      </Stack>
    </Stack>
  );
}
