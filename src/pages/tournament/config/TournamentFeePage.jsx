import {
  Alert,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import {
  FEE_MODE,
  getEntryFee,
  getEntryFeeSummary,
  setEntryFee,
} from "../../../features/individual-tournament/engines/entryFeeEngine.js";
import { useIndividualTournamentConfig } from "../../../features/individual-tournament/hooks/useIndividualTournamentConfig.js";
import TournamentConfigPageShell from "../../../components/tournament/TournamentConfigPageShell.jsx";
import IndividualTournamentSelector from "../../../components/tournament/IndividualTournamentSelector.jsx";

export default function TournamentFeePage() {
  const {
    tournament,
    tournaments,
    tournamentId,
    selectTournament,
    persistTournament,
    message,
    setMessage,
  } = useIndividualTournamentConfig();

  const fee = getEntryFee(tournament);
  const summary = tournament ? getEntryFeeSummary(tournament) : null;

  const save = (patch) => {
    if (!tournament) {
      setMessage({ type: "error", text: "Chưa chọn giải." });
      return;
    }
    const result = setEntryFee(tournament, patch);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error || "Không lưu được." });
      return;
    }
    if (!persistTournament(result.tournament)) return;
    setMessage({ type: "success", text: "Đã lưu lệ phí." });
  };

  return (
    <TournamentConfigPageShell
      title="Lệ phí tham gia"
      description="Miễn phí / cố định / early-bird / late — lưu trên giải cá nhân."
    >
      <IndividualTournamentSelector
        tournaments={tournaments}
        tournamentId={tournamentId}
        onSelect={selectTournament}
      />

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        <FormControlLabel
          control={
            <Switch
              checked={fee.enabled}
              onChange={(event) =>
                save({
                  enabled: event.target.checked,
                  mode: event.target.checked ? FEE_MODE.FIXED : FEE_MODE.FREE,
                })
              }
              disabled={!tournament}
            />
          }
          label="Bật thu lệ phí"
        />
        <FormControl fullWidth size="small" disabled={!tournament || !fee.enabled}>
          <InputLabel>Chế độ phí</InputLabel>
          <Select
            label="Chế độ phí"
            value={fee.mode}
            onChange={(event) => save({ mode: event.target.value, enabled: true })}
          >
            <MenuItem value={FEE_MODE.FREE}>Miễn phí</MenuItem>
            <MenuItem value={FEE_MODE.FIXED}>Phí cố định</MenuItem>
            <MenuItem value={FEE_MODE.EARLY_BIRD}>Early-bird</MenuItem>
            <MenuItem value={FEE_MODE.LATE}>Late registration</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Số tiền cơ bản"
          type="number"
          value={fee.amount}
          onChange={(event) => save({ amount: Number(event.target.value) || 0 })}
          disabled={!tournament || !fee.enabled}
        />
        <TextField
          label="Early-bird amount"
          type="number"
          value={fee.earlyBirdAmount ?? ""}
          onChange={(event) =>
            save({
              earlyBirdAmount: event.target.value === "" ? null : Number(event.target.value),
            })
          }
          disabled={!tournament || !fee.enabled}
        />
        <TextField
          label="Early-bird đến"
          type="datetime-local"
          InputLabelProps={{ shrink: true }}
          value={fee.earlyBirdUntil ? fee.earlyBirdUntil.slice(0, 16) : ""}
          onChange={(event) =>
            save({
              earlyBirdUntil: event.target.value
                ? new Date(event.target.value).toISOString()
                : null,
            })
          }
          disabled={!tournament || !fee.enabled}
        />
        <TextField
          label="Late amount"
          type="number"
          value={fee.lateAmount ?? ""}
          onChange={(event) =>
            save({ lateAmount: event.target.value === "" ? null : Number(event.target.value) })
          }
          disabled={!tournament || !fee.enabled}
        />
        <TextField
          label="Late từ"
          type="datetime-local"
          InputLabelProps={{ shrink: true }}
          value={fee.lateFrom ? fee.lateFrom.slice(0, 16) : ""}
          onChange={(event) =>
            save({
              lateFrom: event.target.value ? new Date(event.target.value).toISOString() : null,
            })
          }
          disabled={!tournament || !fee.enabled}
        />
        <TextField
          label="Đơn vị tiền tệ"
          value={fee.currency}
          onChange={(event) => save({ currency: event.target.value })}
          disabled={!tournament || !fee.enabled}
        />
        <FormControlLabel
          control={
            <Switch
              checked={fee.perPlayer}
              onChange={(event) => save({ perPlayer: event.target.checked })}
              disabled={!tournament || !fee.enabled}
            />
          }
          label="Tính theo từng VĐV"
        />
        <FormControlLabel
          control={
            <Switch
              checked={fee.requirePaidToApprove}
              onChange={(event) => save({ requirePaidToApprove: event.target.checked })}
              disabled={!tournament || !fee.enabled}
            />
          }
          label="Bắt buộc thanh toán trước khi duyệt"
        />
        <TextField
          label="Ghi chú / hướng dẫn phí"
          multiline
          minRows={2}
          value={fee.notes}
          onChange={(event) => save({ notes: event.target.value })}
          disabled={!tournament || !fee.enabled}
        />
        <TextField
          label="Thông báo xác nhận phí"
          value={fee.confirmationMessage}
          onChange={(event) => save({ confirmationMessage: event.target.value })}
          disabled={!tournament}
        />
        <Button variant="contained" onClick={() => save(fee)} disabled={!tournament}>
          Lưu
        </Button>

        {summary && fee.enabled && (
          <Alert severity="info">
            Tóm tắt: thu {summary.totalCollected}/{summary.totalExpected} {fee.currency} · chưa
            thanh toán: {summary.unpaidCount}
          </Alert>
        )}
      </Stack>
    </TournamentConfigPageShell>
  );
}
