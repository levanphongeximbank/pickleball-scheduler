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
import { acceptDailyScoreFieldInput } from "../../../daily-play/canonical/dailyPlayCanonicalDomain.js";
import { resolveDirectorScoreLogSource } from "../../../../tournament/engines/scoreHistoryEngine.js";

function handleDigitsOnly(onChange) {
  return (event) => {
    const next = acceptDailyScoreFieldInput(event.target.value);
    if (next == null) return;
    onChange(next);
  };
}

export default function DirectorScorePanel({
  scoreDialog,
  liveByMatchId,
  scoreA,
  scoreB,
  scoreNote,
  isCorrection = false,
  mutating = false,
  scoreError = null,
  onScoreAChange,
  onScoreBChange,
  onScoreNoteChange,
  onClose,
  onSubmit,
  onDisputeReset,
}) {
  const liveRow = scoreDialog ? liveByMatchId[String(scoreDialog.id)] : null;
  const showOverrideWarning =
    !isCorrection &&
    scoreDialog?.referee?.name &&
    liveRow &&
    resolveDirectorScoreLogSource(scoreDialog, liveRow) === "director_override";

  return (
    <Dialog open={Boolean(scoreDialog)} onClose={onClose} fullWidth>
      <DialogTitle>
        {isCorrection ? "Sửa điểm trận đã hoàn tất" : "Nhập điểm"}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          {scoreDialog?.entryALabel || scoreDialog?.teamALabel} vs{" "}
          {scoreDialog?.entryBLabel || scoreDialog?.teamBLabel}
        </Typography>

        {isCorrection ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Chỉ sửa điểm đã ghi. Trận vẫn hoàn tất — không xếp lại sân và không giữ VĐV.
          </Alert>
        ) : null}

        {showOverrideWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Trận có trọng tài ({scoreDialog.referee.name}). Lưu điểm ở đây sẽ được ghi là{" "}
            <strong>BTC ghi đè</strong>.
          </Alert>
        )}

        {scoreError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {scoreError}
          </Alert>
        ) : null}

        <Stack direction="row" spacing={2}>
          <TextField
            label="Điểm A"
            value={scoreA}
            onChange={handleDigitsOnly(onScoreAChange)}
            inputMode="numeric"
            autoComplete="off"
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            fullWidth
          />
          <TextField
            label="Điểm B"
            value={scoreB}
            onChange={handleDigitsOnly(onScoreBChange)}
            inputMode="numeric"
            autoComplete="off"
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            fullWidth
          />
        </Stack>

        <TextField
          label={isCorrection ? "Lý do sửa điểm (tuỳ chọn)" : "Ghi chú BTC (tuỳ chọn)"}
          value={scoreNote}
          onChange={(event) => onScoreNoteChange(event.target.value)}
          fullWidth
          size="small"
          sx={{ mt: 2 }}
          placeholder={
            isCorrection
              ? "VD: Nhầm điểm, xác nhận lại với trọng tài"
              : "VD: Tranh chấp lưới, xác nhận lại điểm"
          }
        />

        <ScoreLogHistory match={scoreDialog} liveRow={liveRow} title="Lịch sử thay đổi điểm" />
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {scoreDialog && liveRow && !isCorrection && (
          <Button color="warning" onClick={() => onDisputeReset(scoreDialog)}>
            Reset live TT
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={mutating}>
          Bỏ qua
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={mutating}>
          {mutating ? "Đang lưu..." : isCorrection ? "Lưu điểm sửa" : "Lưu điểm"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
