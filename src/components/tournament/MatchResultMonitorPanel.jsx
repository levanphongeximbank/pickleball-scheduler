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
  getMatchResult,
  startIndividualMatch,
} from "../../features/individual-tournament/engines/matchResultEngine.js";
import { propagateMatchResult } from "../../features/individual-tournament/engines/resultPropagationEngine.js";
import { collectEventMatches } from "../../features/individual-tournament/engines/refereeAssignEngine.js";

const RESULT_TYPE_OPTIONS = [
  { value: MATCH_RESULT_TYPE.COMPLETED, label: "Hoàn thành (tỷ số)" },
  { value: MATCH_RESULT_TYPE.WALKOVER, label: "Walkover" },
  { value: MATCH_RESULT_TYPE.RETIREMENT, label: "Bỏ cuộc giữa trận" },
  { value: MATCH_RESULT_TYPE.INJURY, label: "Chấn thương" },
  { value: MATCH_RESULT_TYPE.DISQUALIFICATION, label: "Công bố / DQ" },
  { value: MATCH_RESULT_TYPE.FORFEIT, label: "Bỏ cuộc" },
];

function statusChip(match, stored) {
  if (stored?.locked || match.locked) {
    return <Chip size="small" color="success" label="Đã khóa" />;
  }
  if (stored?.status === "submitted") {
    return <Chip size="small" color="warning" label="Chờ xác nhận" />;
  }
  if (match.status === "playing") {
    return <Chip size="small" color="info" label="Đang đấu" />;
  }
  return <Chip size="small" label={match.status || "—"} />;
}

export default function MatchResultMonitorPanel({
  tournament,
  eventId = "",
  actor = null,
  onTournamentChange,
}) {
  const [message, setMessage] = useState(null);
  const [opsMatchId, setOpsMatchId] = useState("");
  const [scoreA, setScoreA] = useState(11);
  const [scoreB, setScoreB] = useState(0);
  const [resultType, setResultType] = useState(MATCH_RESULT_TYPE.COMPLETED);
  const [winnerId, setWinnerId] = useState("");

  const matches = useMemo(
    () => (tournament ? collectEventMatches(tournament, eventId) : []),
    [tournament, eventId]
  );

  const opsMatch = matches.find((m) => String(m.id) === String(opsMatchId)) || null;

  const persist = (next, text) => {
    onTournamentChange?.(next);
    setMessage({ type: "success", text });
  };

  const handleStart = () => {
    if (!opsMatch) {
      setMessage({ type: "error", text: "Chọn trận." });
      return;
    }
    const started = startIndividualMatch(opsMatch, { actor });
    if (!started.ok) {
      setMessage({ type: "error", text: started.error });
      return;
    }
    const events = (tournament.events || []).map((event) => {
      if (eventId && String(event.id) !== String(opsMatch.eventId || eventId)) {
        return event;
      }
      return {
        ...event,
        matches: (event.matches || []).map((m) =>
          String(m.id) === String(opsMatch.id) ? started.match : m
        ),
      };
    });
    persist({ ...tournament, events }, "Đã bắt đầu trận.");
  };

  const handleFinalize = () => {
    if (!opsMatch) {
      setMessage({ type: "error", text: "Chọn trận." });
      return;
    }

    const payload = {
      resultType,
      scoreA: Number(scoreA),
      scoreB: Number(scoreB),
      winnerId:
        resultType === MATCH_RESULT_TYPE.COMPLETED
          ? undefined
          : winnerId || opsMatch.entryAId,
      reason: resultType,
    };

    const result = propagateMatchResult(tournament, opsMatch.id, {
      eventId: opsMatch.eventId || eventId,
      actor,
      payload,
      source: "director",
    });

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    persist(
      result.tournament,
      result.idempotentReplay
        ? "Lệnh đã xử lý trước đó (idempotent)."
        : "Đã xác nhận kết quả và cập nhật bảng xếp hạng / nhánh."
    );
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để theo dõi kết quả.</Alert>;
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
          Nhập / xác nhận kết quả (BTC)
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
          <TextField
            select
            size="small"
            label="Trận"
            value={opsMatchId}
            onChange={(e) => {
              setOpsMatchId(e.target.value);
              const m = matches.find((x) => String(x.id) === e.target.value);
              setWinnerId(m?.entryAId || "");
            }}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value="">— Chọn trận —</MenuItem>
            {matches.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {(m.entryAId || "A") + " vs " + (m.entryBId || "B")} ({m.status})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Loại kết quả"
            value={resultType}
            onChange={(e) => setResultType(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            {RESULT_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          {resultType === MATCH_RESULT_TYPE.COMPLETED ? (
            <>
              <TextField
                size="small"
                type="number"
                label="Điểm A"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                sx={{ width: 100 }}
              />
              <TextField
                size="small"
                type="number"
                label="Điểm B"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                sx={{ width: 100 }}
              />
            </>
          ) : (
            <TextField
              select
              size="small"
              label="Đội thắng"
              value={winnerId}
              onChange={(e) => setWinnerId(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              {opsMatch ? (
                [
                  <MenuItem key="a" value={opsMatch.entryAId}>
                    Đội A ({opsMatch.entryAId})
                  </MenuItem>,
                  <MenuItem key="b" value={opsMatch.entryBId}>
                    Đội B ({opsMatch.entryBId})
                  </MenuItem>,
                ]
              ) : (
                <MenuItem value="">—</MenuItem>
              )}
            </TextField>
          )}
          <Button variant="outlined" onClick={handleStart} disabled={!opsMatch}>
            Bắt đầu trận
          </Button>
          <Button variant="contained" onClick={handleFinalize} disabled={!opsMatch}>
            Xác nhận kết quả
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Trận</TableCell>
              <TableCell>Tỷ số</TableCell>
              <TableCell>Loại</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Hạng 3?</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matches.map((match) => {
              const stored = getMatchResult(tournament, match.id);
              return (
                <TableRow key={match.id}>
                  <TableCell>
                    {match.entryAId} vs {match.entryBId}
                  </TableCell>
                  <TableCell>
                    {match.scoreA ?? stored?.scoreA ?? "—"} :{" "}
                    {match.scoreB ?? stored?.scoreB ?? "—"}
                  </TableCell>
                  <TableCell>{stored?.resultType || match.resultType || "—"}</TableCell>
                  <TableCell>{statusChip(match, stored)}</TableCell>
                  <TableCell>
                    {stored?.isThirdPlace || match.stage === "third_place" ? "Có" : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
