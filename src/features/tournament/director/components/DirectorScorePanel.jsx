import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import ScoreLogHistory from "../../../../components/tournament/ScoreLogHistory.jsx";
import { resolveDirectorScoreLogSource } from "../../../../tournament/engines/scoreHistoryEngine.js";

export default function DirectorScorePanel({
  scoreDialog,
  liveByMatchId,
  scoreA,
  scoreB,
  scoreNote,
  onScoreAChange,
  onScoreBChange,
  onScoreNoteChange,
  onClose,
  onSubmit,
  onDisputeReset,
}) {
  const liveRow = scoreDialog ? liveByMatchId[String(scoreDialog.id)] : null;
  const showOverrideWarning =
    scoreDialog?.referee?.name &&
    liveRow &&
    resolveDirectorScoreLogSource(scoreDialog, liveRow) === "director_override";

  return (
    <Dialog open={Boolean(scoreDialog)} onClose={onClose} fullWidth>
      <DialogTitle>Nhập điểm</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          {scoreDialog?.entryALabel || scoreDialog?.teamALabel} vs{" "}
          {scoreDialog?.entryBLabel || scoreDialog?.teamBLabel}
        </Typography>

        {showOverrideWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Trận có trọng tài ({scoreDialog.referee.name}). Lưu điểm ở đây sẽ được ghi là{" "}
            <strong>BTC ghi đè</strong>.
          </Alert>
        )}

        <Stack direction="row" spacing={2}>
          <TextField
            label="Điểm A"
            type="number"
            value={scoreA}
            onChange={(event) => onScoreAChange(event.target.value)}
            fullWidth
          />
          <TextField
            label="Điểm B"
            type="number"
            value={scoreB}
            onChange={(event) => onScoreBChange(event.target.value)}
            fullWidth
          />
        </Stack>

        <TextField
          label="Ghi chú BTC (tuỳ chọn)"
          value={scoreNote}
          onChange={(event) => onScoreNoteChange(event.target.value)}
          fullWidth
          size="small"
          sx={{ mt: 2 }}
          placeholder="VD: Tranh chấp lưới, xác nhận lại điểm"
        />

        <ScoreLogHistory match={scoreDialog} liveRow={liveRow} title="Lịch sử thay đổi điểm" />
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {scoreDialog && liveRow && (
          <Button color="warning" onClick={() => onDisputeReset(scoreDialog)}>
            Reset live TT
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Bỏ qua</Button>
        <Button variant="contained" onClick={onSubmit}>
          Lưu điểm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
