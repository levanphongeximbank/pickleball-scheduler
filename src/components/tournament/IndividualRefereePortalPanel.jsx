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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import {
  getRefereeAssignments,
  listIndividualReferees,
  listMatchesForReferee,
} from "../../features/individual-tournament/engines/refereeAssignEngine.js";
import {
  MATCH_RESULT_TYPE,
  submitMatchResult,
  startIndividualMatch,
} from "../../features/individual-tournament/engines/matchResultEngine.js";
import { propagateMatchResult } from "../../features/individual-tournament/engines/resultPropagationEngine.js";
import { buildRefereeUrl } from "../../tournament/engines/refereeEngine.js";

/**
 * Referee portal: My Matches → detail ops → start / submit / confirm.
 */
export default function IndividualRefereePortalPanel({
  tournament,
  actor = null,
  preferredRosterId = "",
  onTournamentChange,
}) {
  const [message, setMessage] = useState(null);
  const [rosterId, setRosterId] = useState(preferredRosterId);
  const [activeMatchId, setActiveMatchId] = useState("");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  const referees = useMemo(
    () => (tournament ? listIndividualReferees(tournament) : []),
    [tournament]
  );

  const myMatches = useMemo(() => {
    if (!tournament || !rosterId) return [];
    return listMatchesForReferee(tournament, rosterId);
  }, [tournament, rosterId]);

  const activeMatch = myMatches.find((m) => String(m.id) === String(activeMatchId)) || null;

  const replaceMatchInTournament = (nextMatch) => {
    const events = (tournament.events || []).map((event) => ({
      ...event,
      matches: (event.matches || []).map((m) =>
        String(m.id) === String(nextMatch.id) ? { ...m, ...nextMatch } : m
      ),
    }));
    return { ...tournament, events };
  };

  const handleStart = () => {
    if (!activeMatch) return;
    const started = startIndividualMatch(activeMatch);
    if (!started.ok) {
      setMessage({ type: "error", text: started.error });
      return;
    }
    onTournamentChange?.(replaceMatchInTournament(started.match));
    setMessage({ type: "success", text: "Đã bắt đầu trận." });
  };

  const handleSubmitScore = () => {
    if (!activeMatch) return;
    const result = submitMatchResult(
      tournament,
      activeMatch,
      {
        resultType: MATCH_RESULT_TYPE.COMPLETED,
        scoreA: Number(scoreA),
        scoreB: Number(scoreB),
      },
      { actor, source: "referee", eventId: activeMatch.eventId }
    );
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    const withMatch = {
      ...result.tournament,
      events: replaceMatchInTournament(result.match).events,
    };
    onTournamentChange?.(withMatch);
    setMessage({ type: "success", text: "Đã gửi tỷ số — chờ xác nhận." });
  };

  const handleConfirm = () => {
    if (!activeMatch) return;
    const propagated = propagateMatchResult(tournament, activeMatch.id, {
      eventId: activeMatch.eventId,
      actor,
      source: "referee",
      payload: {
        resultType: MATCH_RESULT_TYPE.COMPLETED,
        scoreA: Number(scoreA),
        scoreB: Number(scoreB),
      },
    });

    if (!propagated.ok) {
      setMessage({ type: "error", text: propagated.error });
      return;
    }

    onTournamentChange?.(propagated.tournament);
    setMessage({
      type: "success",
      text: propagated.idempotentReplay
        ? "Kết quả đã xác nhận trước đó."
        : "Đã xác nhận kết quả và cập nhật giải.",
    });
  };

  if (!tournament) {
    return <Alert severity="info">Chọn giải để xem trận được phân công.</Alert>;
  }

  const assignments = getRefereeAssignments(tournament);

  return (
    <Stack spacing={2}>
      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Trận của tôi
        </Typography>
        <TextField
          select
          size="small"
          label="Trọng tài"
          value={rosterId}
          onChange={(e) => setRosterId(e.target.value)}
          sx={{ minWidth: 220, mb: 2 }}
        >
          <MenuItem value="">— Chọn tên —</MenuItem>
          {referees.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.name}
            </MenuItem>
          ))}
        </TextField>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Trận</TableCell>
              <TableCell>TT</TableCell>
              <TableCell>Link</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {myMatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">
                    {rosterId
                      ? "Chưa được phân công trận nào."
                      : "Chọn trọng tài để xem trận."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              myMatches.map((match) => (
                <TableRow key={match.id} selected={match.id === activeMatchId}>
                  <TableCell>
                    {match.entryAId} vs {match.entryBId}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={match.status || "—"} />
                  </TableCell>
                  <TableCell>
                    {assignments[match.id]?.token || match.referee?.token ? (
                      <Button
                        size="small"
                        endIcon={<OpenInNewIcon />}
                        href={buildRefereeUrl(
                          assignments[match.id]?.token || match.referee?.token
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Bảng điểm
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => setActiveMatchId(match.id)}>
                      Chi tiết
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {activeMatch ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Chi tiết trận — {activeMatch.entryAId} vs {activeMatch.entryBId}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
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
            <Button variant="outlined" onClick={handleStart}>
              Bắt đầu trận
            </Button>
            <Button variant="outlined" onClick={handleSubmitScore}>
              Gửi tỷ số
            </Button>
            <Button variant="contained" onClick={handleConfirm}>
              Xác nhận kết quả
            </Button>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
