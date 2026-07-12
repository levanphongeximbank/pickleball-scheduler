import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";

import { validateForfeitReason } from "../../../features/team-tournament/engines/forfeitWorkflowEngine.js";

export default function TeamWithdrawTeamDialog({
  open,
  onClose,
  team,
  busy = false,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async () => {
    setLocalError("");
    const reasonCheck = validateForfeitReason(reason, { minLength: 5 });
    if (!reasonCheck.ok) {
      setLocalError(reasonCheck.error);
      return;
    }
    await onConfirm?.({
      teamId: team?.id,
      reason: reasonCheck.reason,
      reasonCode: "team_withdrawal",
    });
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <ExitToAppIcon color="error" />
          <span>Đội rút khỏi giải</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            Xác nhận rút đội <strong>{team?.name || team?.id}</strong>. Các trận chưa đấu sẽ ghi
            thua kỹ thuật; kết quả đã confirmed sẽ không bị ghi đè.
          </Typography>
          <TextField
            label="Lý do rút giải"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={3}
            required
            fullWidth
          />
          {localError ? <Alert severity="error">{localError}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button variant="contained" color="error" disabled={busy} onClick={handleSubmit}>
          Xác nhận rút giải
        </Button>
      </DialogActions>
    </Dialog>
  );
}
