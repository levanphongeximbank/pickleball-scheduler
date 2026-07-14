import { useMemo, useState } from "react";

import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  WITHDRAWAL_PHASE,
  WITHDRAWAL_STATUS,
  approveWithdrawal,
  listPendingWithdrawals,
  listWithdrawalHistory,
  rejectWithdrawal,
  requestWithdrawal,
} from "../../features/individual-tournament/engines/withdrawalEngine.js";
import { isTournamentClosed } from "../../features/individual-tournament/engines/tournamentClosingEngine.js";

export default function WithdrawalManagementPanel({
  tournament,
  eventId = "",
  actor = null,
  onTournamentChange,
}) {
  const [message, setMessage] = useState(null);
  const [entryId, setEntryId] = useState("");
  const [phase, setPhase] = useState(WITHDRAWAL_PHASE.BEFORE_EVENT);
  const [reason, setReason] = useState("");
  const [replacementEntryId, setReplacementEntryId] = useState("");

  const event =
    (tournament?.events || []).find((e) => String(e.id) === String(eventId)) ||
    tournament?.events?.[0];
  const entries = event?.entries || [];
  const closed = tournament ? isTournamentClosed(tournament) : false;

  const pending = useMemo(
    () => (tournament ? listPendingWithdrawals(tournament) : []),
    [tournament]
  );
  const history = useMemo(
    () => (tournament ? listWithdrawalHistory(tournament) : []),
    [tournament]
  );

  const request = () => {
    const result = requestWithdrawal(tournament, {
      entryId,
      eventId: event?.id || eventId,
      phase,
      reason,
      replacementEntryId,
      actor,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({ type: "success", text: "Đã gửi yêu cầu rút lui." });
    setReason("");
  };

  const approve = (id) => {
    const result = approveWithdrawal(tournament, id, {
      actor,
      replacementEntryId,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({ type: "success", text: "Đã duyệt rút lui — bracket/standings cập nhật." });
  };

  const reject = (id) => {
    const result = rejectWithdrawal(tournament, id, {
      actor,
      reason: "Từ chối",
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({ type: "info", text: "Đã từ chối yêu cầu." });
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để xử lý rút lui.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Yêu cầu rút lui
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            select
            size="small"
            label="Cặp / đội"
            value={entryId}
            onChange={(e) => setEntryId(e.target.value)}
            sx={{ minWidth: 200 }}
            disabled={closed}
          >
            <MenuItem value="">— Chọn —</MenuItem>
            {entries.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name || e.id} ({e.status})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Giai đoạn"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            sx={{ minWidth: 180 }}
            disabled={closed}
          >
            <MenuItem value={WITHDRAWAL_PHASE.BEFORE_EVENT}>Trước giải</MenuItem>
            <MenuItem value={WITHDRAWAL_PHASE.DURING_EVENT}>Trong giải</MenuItem>
            <MenuItem value={WITHDRAWAL_PHASE.INJURY}>Chấn thương</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Thay thế (tuỳ chọn)"
            value={replacementEntryId}
            onChange={(e) => setReplacementEntryId(e.target.value)}
            sx={{ minWidth: 180 }}
            disabled={closed}
          >
            <MenuItem value="">— Không —</MenuItem>
            {entries
              .filter((e) => e.id !== entryId)
              .map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name || e.id}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            size="small"
            label="Lý do"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={closed}
          />
          <Button variant="contained" onClick={request} disabled={closed || !entryId}>
            Gửi yêu cầu
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ overflowX: "auto" }}>
        <Typography variant="subtitle2" sx={{ p: 1.5, pb: 0 }}>
          Chờ duyệt
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Đội</TableCell>
              <TableCell>Phase</TableCell>
              <TableCell>Lý do</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {pending.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">Không có yêu cầu chờ.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              pending.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.entryId}</TableCell>
                  <TableCell>{w.phase}</TableCell>
                  <TableCell>{w.reason}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" disabled={closed} onClick={() => approve(w.id)}>
                        Duyệt
                      </Button>
                      <Button size="small" disabled={closed} onClick={() => reject(w.id)}>
                        Từ chối
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ overflowX: "auto" }}>
        <Typography variant="subtitle2" sx={{ p: 1.5, pb: 0 }}>
          Lịch sử
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Đội</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Thay thế</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.map((w) => (
              <TableRow key={w.id}>
                <TableCell>{w.entryId}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={
                      w.status === WITHDRAWAL_STATUS.APPROVED
                        ? "success"
                        : w.status === WITHDRAWAL_STATUS.REJECTED
                          ? "default"
                          : "warning"
                    }
                    label={w.status}
                  />
                </TableCell>
                <TableCell>{w.replacementEntryId || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
