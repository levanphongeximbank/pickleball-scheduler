import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import {
  getEntryFee,
  setEntryFee,
} from "../../../features/team-tournament/engines/entryFeeEngine.js";
import { initializeTeamTournamentData } from "../../../features/team-tournament/engines/teamTournamentEngine.js";

export default function TournamentFeePage() {
  const [teamData, setTeamData] = useState(() => initializeTeamTournamentData());
  const [message, setMessage] = useState(null);
  const fee = getEntryFee(teamData);

  const save = (patch) => {
    const result = setEntryFee(teamData, patch);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return;
    }
    setTeamData(result.teamData);
    setMessage({ type: "success", text: "Đã cập nhật lệ phí tham gia." });
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Lệ phí tham gia
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Cấu hình mức phí và hạn thanh toán cho đội/VĐV.
      </Typography>

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Stack spacing={2} sx={{ maxWidth: 420 }}>
        <FormControlLabel
          control={
            <Switch
              checked={fee.enabled}
              onChange={(event) => save({ enabled: event.target.checked })}
            />
          }
          label="Bật thu lệ phí"
        />
        <TextField
          label="Số tiền"
          type="number"
          value={fee.amount}
          onChange={(event) => save({ amount: Number(event.target.value) || 0 })}
          disabled={!fee.enabled}
        />
        <TextField
          label="Đơn vị tiền tệ"
          value={fee.currency}
          onChange={(event) => save({ currency: event.target.value })}
          disabled={!fee.enabled}
        />
        <FormControlLabel
          control={
            <Switch
              checked={fee.perPlayer}
              onChange={(event) => save({ perPlayer: event.target.checked })}
              disabled={!fee.enabled}
            />
          }
          label="Tính theo từng VĐV"
        />
        <TextField
          label="Hạn thanh toán"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={fee.dueDate ? fee.dueDate.slice(0, 10) : ""}
          onChange={(event) => save({ dueDate: event.target.value || null })}
          disabled={!fee.enabled}
        />
        <TextField
          label="Ghi chú"
          multiline
          minRows={2}
          value={fee.notes}
          onChange={(event) => save({ notes: event.target.value })}
          disabled={!fee.enabled}
        />
        <Button variant="contained" onClick={() => save(fee)}>
          Lưu
        </Button>
      </Stack>
    </Box>
  );
}
