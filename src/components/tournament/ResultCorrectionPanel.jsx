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
  MATCH_RESULT_TYPE,
} from "../../features/individual-tournament/engines/matchResultEngine.js";
import {
  CORRECTION_STATUS,
  approveResultCorrection,
  listResultCorrections,
  rejectResultCorrection,
  requestResultCorrection,
} from "../../features/individual-tournament/engines/resultCorrectionEngine.js";
import { collectEventMatches } from "../../features/individual-tournament/engines/refereeAssignEngine.js";

export default function ResultCorrectionPanel({
  tournament,
  eventId = "",
  actor = null,
  onTournamentChange,
}) {
  const [message, setMessage] = useState(null);
  const [matchId, setMatchId] = useState("");
  const [scoreA, setScoreA] = useState(11);
  const [scoreB, setScoreB] = useState(5);
  const [reason, setReason] = useState("");

  const matches = useMemo(
    () =>
      (tournament ? collectEventMatches(tournament, eventId) : []).filter(
        (m) => m.status === "completed" || m.status === "forfeit" || m.locked
      ),
    [tournament, eventId]
  );

  const corrections = useMemo(
    () => (tournament ? listResultCorrections(tournament) : []),
    [tournament]
  );

  const handleRequest = () => {
    const result = requestResultCorrection(tournament, {
      matchId,
      eventId:
        matches.find((m) => String(m.id) === String(matchId))?.eventId || eventId,
      actor,
      scoreA: Number(scoreA),
      scoreB: Number(scoreB),
      resultType: MATCH_RESULT_TYPE.COMPLETED,
      reason: reason || "BTC sửa kết quả",
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({ type: "success", text: "Đã gửi yêu cầu sửa kết quả." });
    setReason("");
  };

  const handleApprove = (correctionId) => {
    const result = approveResultCorrection(tournament, correctionId, { actor });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({
      type: "success",
      text: "Đã duyệt sửa — đã tính lại nhánh / bảng xếp hạng.",
    });
  };

  const handleReject = (correctionId) => {
    const result = rejectResultCorrection(tournament, correctionId, {
      actor,
      note: "Từ chối",
    });
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onTournamentChange?.(result.tournament);
    setMessage({ type: "success", text: "Đã từ chối yêu cầu sửa." });
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để sửa kết quả.</Alert>;
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
          Yêu cầu sửa kết quả (BTC)
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            select
            size="small"
            label="Trận đã kết thúc"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">— Chọn trận —</MenuItem>
            {matches.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.entryAId} vs {m.entryBId} ({m.scoreA ?? "—"}:{m.scoreB ?? "—"})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="number"
            label="Điểm A mới"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            sx={{ width: 110 }}
          />
          <TextField
            size="small"
            type="number"
            label="Điểm B mới"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            sx={{ width: 110 }}
          />
          <TextField
            size="small"
            label="Lý do"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            sx={{ minWidth: 180 }}
          />
          <Button variant="contained" onClick={handleRequest} disabled={!matchId}>
            Gửi yêu cầu
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã</TableCell>
              <TableCell>Trận</TableCell>
              <TableCell>Đề xuất</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {corrections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">Chưa có yêu cầu sửa.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              corrections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.id}</TableCell>
                  <TableCell>{c.matchId}</TableCell>
                  <TableCell>
                    {c.proposed?.scoreA}:{c.proposed?.scoreB} ({c.proposed?.resultType})
                    <Typography variant="caption" display="block" color="text.secondary">
                      {c.reason}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={
                        c.status === CORRECTION_STATUS.APPROVED
                          ? "success"
                          : c.status === CORRECTION_STATUS.REJECTED
                            ? "default"
                            : "warning"
                      }
                      label={c.status}
                    />
                  </TableCell>
                  <TableCell>
                    {c.status === CORRECTION_STATUS.PENDING ? (
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" onClick={() => handleApprove(c.id)}>
                          Duyệt
                        </Button>
                        <Button size="small" onClick={() => handleReject(c.id)}>
                          Từ chối
                        </Button>
                      </Stack>
                    ) : (
                      "—"
                    )}
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
