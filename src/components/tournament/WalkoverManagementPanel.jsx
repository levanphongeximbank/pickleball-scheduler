import { useMemo, useState } from "react";

import {
  Alert,
  Button,
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
  WALKOVER_REASON,
  declareWalkover,
  listWalkovers,
} from "../../features/individual-tournament/engines/walkoverEngine.js";
import { collectEventMatches } from "../../features/individual-tournament/engines/refereeAssignEngine.js";
import { isTournamentClosed } from "../../features/individual-tournament/engines/tournamentClosingEngine.js";

export default function WalkoverManagementPanel({
  tournament,
  eventId = "",
  actor = null,
  onTournamentChange,
}) {
  const [message, setMessage] = useState(null);
  const [matchId, setMatchId] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [reasonType, setReasonType] = useState(WALKOVER_REASON.NO_SHOW);
  const [reason, setReason] = useState("");

  const matches = useMemo(
    () =>
      (tournament ? collectEventMatches(tournament, eventId) : []).filter(
        (m) =>
          m.status !== "completed" &&
          m.status !== "forfeit" &&
          !m.locked &&
          m.entryAId &&
          m.entryBId
      ),
    [tournament, eventId]
  );

  const selected = matches.find((m) => String(m.id) === String(matchId));
  const walkovers = tournament ? listWalkovers(tournament) : [];
  const closed = tournament ? isTournamentClosed(tournament) : false;

  const handleDeclare = () => {
    const result = declareWalkover(tournament, {
      matchId,
      winnerId,
      eventId: selected?.eventId || eventId,
      reasonType,
      reason: reason || reasonType,
      actor,
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({
      type: "success",
      text: result.idempotentReplay
        ? "Walkover đã ghi nhận trước đó."
        : "Đã tuyên bố walkover — winner advances, standings cập nhật.",
    });
    setMatchId("");
    setWinnerId("");
    setReason("");
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để quản lý walkover.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}
      {closed ? <Alert severity="warning">Giải đã đóng — không thể tuyên bố walkover mới.</Alert> : null}

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Tuyên bố walkover (no-show / BTC)
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            select
            size="small"
            label="Trận"
            value={matchId}
            onChange={(e) => {
              setMatchId(e.target.value);
              const m = matches.find((x) => String(x.id) === e.target.value);
              setWinnerId(m?.entryAId || "");
            }}
            sx={{ minWidth: 260 }}
            disabled={closed}
          >
            <MenuItem value="">— Chọn trận —</MenuItem>
            {matches.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.entryAId} vs {m.entryBId}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Đội thắng (WO)"
            value={winnerId}
            onChange={(e) => setWinnerId(e.target.value)}
            sx={{ minWidth: 180 }}
            disabled={closed || !selected}
          >
            {selected ? (
              [
                <MenuItem key="a" value={selected.entryAId}>
                  {selected.entryAId}
                </MenuItem>,
                <MenuItem key="b" value={selected.entryBId}>
                  {selected.entryBId}
                </MenuItem>,
              ]
            ) : (
              <MenuItem value="">—</MenuItem>
            )}
          </TextField>
          <TextField
            select
            size="small"
            label="Lý do"
            value={reasonType}
            onChange={(e) => setReasonType(e.target.value)}
            sx={{ minWidth: 160 }}
            disabled={closed}
          >
            <MenuItem value={WALKOVER_REASON.NO_SHOW}>Vắng mặt (no-show)</MenuItem>
            <MenuItem value={WALKOVER_REASON.ORGANIZER}>BTC tuyên bố</MenuItem>
            <MenuItem value={WALKOVER_REASON.OTHER}>Khác</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Ghi chú"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={closed}
          />
          <Button
            variant="contained"
            color="warning"
            onClick={handleDeclare}
            disabled={closed || !matchId || !winnerId}
          >
            Tuyên bố WO
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Trận</TableCell>
              <TableCell>Thắng</TableCell>
              <TableCell>Lý do</TableCell>
              <TableCell>Thời điểm</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {walkovers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">Chưa có walkover.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              walkovers.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.matchId}</TableCell>
                  <TableCell>{w.winnerId}</TableCell>
                  <TableCell>{w.reasonType}</TableCell>
                  <TableCell>
                    {w.declaredAt ? new Date(w.declaredAt).toLocaleString("vi-VN") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
