import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import SportsIcon from "@mui/icons-material/Sports";

import {
  hasSupabaseConfig,
  MATCH_LIVE_STATUS,
  REFEREE_LINK_LOCKED_MESSAGE,
} from "../../domain/matchLiveSync.js";
import {
  isRefereeMatchLocked,
  resolveRefereeMatchStatus,
  resolveRefereeStatusLabel,
} from "../../tournament/engines/refereeStatusEngine.js";
import {
  officialAdjustLiveScoreCommand,
  officialCommitMatchResultCommand,
  officialRefereeGetMatchCommand,
} from "../../features/tournament/official-lifecycle/officialOpenLifecycleCommands.js";
import { newOfficialLifecycleIdempotencyKey } from "../../features/tournament/official-lifecycle/officialOpenLifecycleService.js";

function TeamScoreControls({
  label,
  score,
  disabled,
  onIncrement,
  onDecrement,
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        flex: 1,
        textAlign: "center",
        borderRadius: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ mb: 1, minHeight: 44, display: "grid", placeItems: "center" }}
      >
        {label}
      </Typography>
      <Typography variant="h2" fontWeight="bold" sx={{ my: 1.5, lineHeight: 1 }}>
        {score}
      </Typography>
      <Stack spacing={1.25} alignItems="center">
        <Button
          variant="contained"
          color="primary"
          disabled={disabled}
          onClick={onIncrement}
          startIcon={<AddIcon />}
          sx={{ width: "100%", minHeight: 56, fontSize: "1.05rem", fontWeight: 700 }}
        >
          +1
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          disabled={disabled || score <= 0}
          onClick={onDecrement}
          startIcon={<RemoveIcon />}
          size="small"
          sx={{ minWidth: 96 }}
        >
          -1
        </Button>
      </Stack>
    </Paper>
  );
}

function mapOfficialLiveRow(data) {
  if (!data || data.ok === false) return null;
  const status = data.finalized
    ? MATCH_LIVE_STATUS.PROCESSED
    : data.status || MATCH_LIVE_STATUS.PLAYING;
  return {
    matchId: data.matchId,
    tournamentName: data.tournamentName,
    stageLabel: data.stageLabel,
    entryALabel: data.entryALabel,
    entryBLabel: data.entryBLabel,
    courtLabel: data.courtLabel,
    scheduledStart: data.scheduledStart,
    scoringMethod: data.scoringMethod || "rally",
    scoringMethodLabel: data.scoringMethodLabel || "Rally",
    targetScore: data.targetScore,
    scoreA: Number(data.scoreA || 0),
    scoreB: Number(data.scoreB || 0),
    status,
    liveRevision: data.liveRevision,
    canonicalResult: data.canonicalResult || null,
    refereeName: "",
  };
}

export default function RefereeScoreboard({ sessionToken = null, sessionMode = false } = {}) {
  const { token: rawToken } = useParams();
  const token = sessionToken || decodeURIComponent(rawToken || "");
  void sessionMode;

  const [row, setRow] = useState(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmDecrement, setConfirmDecrement] = useState(null);
  const [done, setDone] = useState(false);

  const displayStatus = useMemo(
    () => resolveRefereeStatusLabel(resolveRefereeMatchStatus({ referee: { token } }, row)),
    [row, token]
  );

  const applyRow = useCallback((nextRow) => {
    if (!nextRow) return;
    setRow(nextRow);
    setScoreA(Number(nextRow.scoreA || 0));
    setScoreB(Number(nextRow.scoreB || 0));
    setLocked(Boolean(nextRow.canonicalResult) || isRefereeMatchLocked(nextRow));
  }, []);

  const loadMatch = useCallback(async () => {
    if (!token) {
      setError(REFEREE_LINK_LOCKED_MESSAGE);
      setLoading(false);
      return;
    }

    if (!hasSupabaseConfig()) {
      setError("Hệ thống chưa cấu hình Supabase. Liên hệ BTC giải.");
      setLoading(false);
      return;
    }

    const result = await officialRefereeGetMatchCommand(token);
    if (!result.ok) {
      setError(result.error || REFEREE_LINK_LOCKED_MESSAGE);
      setLoading(false);
      return;
    }

    applyRow(mapOfficialLiveRow(result));
    setLoading(false);
  }, [token, applyRow]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  const handleAdjust = async (team, delta) => {
    if (locked || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await officialAdjustLiveScoreCommand({
      token,
      team,
      delta,
      expectedScoreA: scoreA,
      expectedScoreB: scoreB,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || REFEREE_LINK_LOCKED_MESSAGE);
      if (result.scoreA != null && result.scoreB != null) {
        applyRow({
          ...row,
          scoreA: result.scoreA,
          scoreB: result.scoreB,
          liveRevision: result.liveRevision,
          status: result.status || row?.status,
        });
      }
      return;
    }

    applyRow({
      ...row,
      scoreA: result.scoreA,
      scoreB: result.scoreB,
      liveRevision: result.liveRevision,
      status: result.status || MATCH_LIVE_STATUS.PLAYING,
    });
    setMessage(null);
  };

  const handleRequestDecrement = (team) => {
    const currentScore = team === "A" ? scoreA : scoreB;
    if (currentScore <= 0) {
      return;
    }
    setConfirmDecrement(team);
  };

  const handleConfirmFinalize = async () => {
    setConfirmFinalizeOpen(false);
    setSubmitting(true);
    setError(null);

    const result = await officialCommitMatchResultCommand({
      token,
      scoreA,
      scoreB,
      idempotencyKey: newOfficialLifecycleIdempotencyKey(`ref-${token.slice(-8)}`),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || REFEREE_LINK_LOCKED_MESSAGE);
      return;
    }

    applyRow({
      ...row,
      scoreA: result.scoreA ?? scoreA,
      scoreB: result.scoreB ?? scoreB,
      status: MATCH_LIVE_STATUS.PROCESSED,
      canonicalResult: {
        scoreA: result.scoreA ?? scoreA,
        scoreB: result.scoreB ?? scoreB,
        winnerName: result.winnerName || "",
        status: "completed",
      },
    });
    setLocked(true);
    setDone(true);
    setMessage(
      result.winnerName
        ? `Đã chốt kết quả ${result.scoreA} — ${result.scoreB}. Thắng: ${result.winnerName}.`
        : `Đã chốt kết quả ${result.scoreA} — ${result.scoreB} vào giải.`
    );
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <Typography color="text.secondary">Đang tải trận đấu...</Typography>
      </Box>
    );
  }

  if (error && !row) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const statusChipColor =
    row?.status === MATCH_LIVE_STATUS.PLAYING
      ? "success"
      : row?.status === MATCH_LIVE_STATUS.FINALIZE_REQUESTED
        ? "warning"
        : locked
          ? "default"
          : "info";

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", pb: 4 }}>
      {!sessionMode && (
        <Container maxWidth="sm" sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            Bảng điểm trọng tài · chỉ vận hành trận được phân công.
          </Alert>
        </Container>
      )}
      <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText", py: 2.5, px: 2 }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <SportsIcon sx={{ mt: 0.25 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" sx={{ opacity: 0.9 }}>
              Console trọng tài
            </Typography>
            <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.3 }}>
              {row?.tournamentName || "Giải đấu"}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.92 }}>
              {row?.stageLabel ? `${row.stageLabel}` : "Trận Official"}
              {row?.courtLabel ? ` · ${row.courtLabel}` : ""}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Container maxWidth="sm" sx={{ pt: 2 }}>
        {message && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Trận đấu
          </Typography>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, lineHeight: 1.35 }}>
            {row?.entryALabel} vs {row?.entryBLabel}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {row?.stageLabel && <Chip label={row.stageLabel} size="small" />}
            {row?.courtLabel && <Chip label={row.courtLabel} size="small" variant="outlined" />}
            {row?.scheduledStart ? (
              <Chip
                label={new Date(row.scheduledStart).toLocaleString("vi-VN")}
                size="small"
                variant="outlined"
              />
            ) : null}
            <Chip label={row?.scoringMethodLabel || "Rally"} size="small" />
            {row?.targetScore ? (
              <Chip label={`Điểm đích ${row.targetScore}`} size="small" color="info" />
            ) : null}
            <Chip label={displayStatus} size="small" color={statusChipColor} />
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Rally · điểm đích {row?.targetScore || "—"} · kết quả chốt ghi vào giải (không qua Director).
          </Typography>
          <Typography variant="h4" fontWeight="bold" sx={{ mt: 2 }}>
            {scoreA} — {scoreB}
          </Typography>
        </Paper>

        {!locked && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
            <TeamScoreControls
              label={row?.entryALabel || "Đội A"}
              score={scoreA}
              disabled={locked || submitting}
              onIncrement={() => handleAdjust("A", 1)}
              onDecrement={() => handleRequestDecrement("A")}
            />
            <TeamScoreControls
              label={row?.entryBLabel || "Đội B"}
              score={scoreB}
              disabled={locked || submitting}
              onIncrement={() => handleAdjust("B", 1)}
              onDecrement={() => handleRequestDecrement("B")}
            />
          </Stack>
        )}

        {!locked && (
          <Button
            fullWidth
            size="large"
            variant="contained"
            color="success"
            disabled={
              submitting ||
              scoreA === scoreB ||
              (Number(row?.targetScore) > 0 && Math.max(scoreA, scoreB) < Number(row.targetScore))
            }
            onClick={() => setConfirmFinalizeOpen(true)}
            sx={{ minHeight: 56, fontSize: "1.05rem", fontWeight: 700 }}
          >
            Chốt kết quả
          </Button>
        )}

        {locked && row?.canonicalResult && (
          <Alert severity="success">
            Kết quả chính thức: {row.canonicalResult.scoreA} — {row.canonicalResult.scoreB}
            {row.canonicalResult.winnerName ? ` · Thắng: ${row.canonicalResult.winnerName}` : ""}.
          </Alert>
        )}

        {locked && row?.status === MATCH_LIVE_STATUS.FINALIZE_REQUESTED && (
          <Alert severity="info">
            Kết quả {scoreA} — {scoreB} đang chờ ghi vào giải.
          </Alert>
        )}

        {locked &&
          !row?.canonicalResult &&
          (row?.status === MATCH_LIVE_STATUS.LOCKED || row?.status === MATCH_LIVE_STATUS.PROCESSED) && (
          <Alert severity="success">
            Trận đã khóa: {scoreA} — {scoreB}.
          </Alert>
        )}

        <Button
          fullWidth
          variant="text"
          color="inherit"
          sx={{ mt: 3, minHeight: 48 }}
          onClick={() => {
            setDone(true);
            setMessage("Có thể đóng trang này.");
          }}
        >
          {done ? "Có thể đóng trang này" : "Kết thúc / đóng trang"}
        </Button>
      </Container>

      <Dialog open={confirmFinalizeOpen} onClose={() => setConfirmFinalizeOpen(false)}>
        <DialogTitle>Xác nhận chốt kết quả</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn chắc chắn muốn chốt kết quả trận này?
          </Typography>
          <Typography variant="h5" fontWeight="bold" sx={{ mt: 2 }}>
            {scoreA} — {scoreB}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmFinalizeOpen(false)}>Huỷ</Button>
          <Button variant="contained" color="success" onClick={handleConfirmFinalize}>
            Chốt kết quả
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(confirmDecrement)} onClose={() => setConfirmDecrement(null)}>
        <DialogTitle>Giảm điểm?</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn muốn trừ 1 điểm cho {confirmDecrement === "A" ? row?.entryALabel : row?.entryBLabel}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDecrement(null)}>Huỷ</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => {
              const team = confirmDecrement;
              setConfirmDecrement(null);
              handleAdjust(team, -1);
            }}
          >
            Trừ 1 điểm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
