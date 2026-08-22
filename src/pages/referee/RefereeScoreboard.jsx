import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
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
import UndoIcon from "@mui/icons-material/Undo";
import SportsIcon from "@mui/icons-material/Sports";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

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
import {
  applyOfficialCore16RallyOutcome,
  assertOfficialCore16TerminalForCommit,
  confirmOfficialCore16ChangeEnds,
  createOfficialCore16LiveScoringSession,
  parseOfficialCore16RulesQuery,
  undoOfficialCore16LastPoint,
} from "../../features/tournament/official-open-adapter-b/officialOpenCore16LiveScoringBinding.js";
import { SCORING_SYSTEM } from "../../features/competition-core/scoring/index.js";

function TeamScoreControls({
  label,
  score,
  disabled,
  serving,
  serverNumber,
  onRallyWon,
  rallyLabel,
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        flex: 1,
        textAlign: "center",
        borderRadius: 2,
        borderColor: serving ? "primary.main" : undefined,
        borderWidth: serving ? 2 : 1,
      }}
    >
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ mb: 1, minHeight: 44, display: "grid", placeItems: "center" }}
      >
        {label}
      </Typography>
      {serving ? (
        <Chip
          size="small"
          color="primary"
          label={serverNumber != null ? `Đang giao · Server ${serverNumber}` : "Đang giao"}
          sx={{ mb: 1 }}
        />
      ) : (
        <Box sx={{ height: 32, mb: 1 }} />
      )}
      <Typography variant="h2" fontWeight="bold" sx={{ my: 1.5, lineHeight: 1 }}>
        {score}
      </Typography>
      <Button
        variant="contained"
        color="primary"
        disabled={disabled}
        onClick={onRallyWon}
        startIcon={<AddIcon />}
        sx={{ width: "100%", minHeight: 56, fontSize: "1.05rem", fontWeight: 700 }}
      >
        {rallyLabel}
      </Button>
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

/**
 * Demoted classic writer: project absolute CORE-16 scores onto tournament_match_live
 * via ±1 RPC after CORE-16 ACK. Not scoring authority.
 */
async function projectClassicLiveScores({
  token,
  fromA,
  fromB,
  toA,
  toB,
}) {
  let a = Number(fromA) || 0;
  let b = Number(fromB) || 0;
  const targetA = Number(toA) || 0;
  const targetB = Number(toB) || 0;
  let liveRevision = null;
  let status = null;

  while (a !== targetA || b !== targetB) {
    let team;
    let delta;
    if (a < targetA) {
      team = "A";
      delta = 1;
    } else if (a > targetA) {
      team = "A";
      delta = -1;
    } else if (b < targetB) {
      team = "B";
      delta = 1;
    } else if (b > targetB) {
      team = "B";
      delta = -1;
    } else {
      break;
    }
    const result = await officialAdjustLiveScoreCommand({
      token,
      team,
      delta,
      expectedScoreA: a,
      expectedScoreB: b,
    });
    if (!result.ok) {
      return { ok: false, error: result.error, scoreA: a, scoreB: b, liveRevision, status };
    }
    a = Number(result.scoreA);
    b = Number(result.scoreB);
    liveRevision = result.liveRevision;
    status = result.status;
  }
  return { ok: true, scoreA: a, scoreB: b, liveRevision, status };
}

export default function RefereeScoreboard({ sessionToken = null, sessionMode = false } = {}) {
  const { token: rawToken } = useParams();
  const location = useLocation();
  const token = sessionToken || decodeURIComponent(rawToken || "");
  void sessionMode;

  const rulesQuery = useMemo(
    () => parseOfficialCore16RulesQuery(location.search || ""),
    [location.search]
  );

  const [row, setRow] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [done, setDone] = useState(false);

  const readModel = session?.readModel || null;
  const scoreA = readModel?.scoreA ?? Number(row?.scoreA || 0);
  const scoreB = readModel?.scoreB ?? Number(row?.scoreB || 0);
  const isSideOut =
    String(session?.format?.scoringSystem || "").toUpperCase() === SCORING_SYSTEM.SIDE_OUT;

  const displayStatus = useMemo(
    () => resolveRefereeStatusLabel(resolveRefereeMatchStatus({ referee: { token } }, row)),
    [row, token]
  );

  const applyRow = useCallback((nextRow) => {
    if (!nextRow) return;
    setRow(nextRow);
    setLocked(Boolean(nextRow.canonicalResult) || isRefereeMatchLocked(nextRow));
  }, []);

  const bootstrapCore16Session = useCallback(
    (liveRow) => {
      const envelope = rulesQuery.ok ? rulesQuery.envelope : null;
      const tenantId =
        envelope?.tenantId ||
        // Fail closed identity: prefer envelope; else synthetic tenant scoped to live match.
        `official-live:${liveRow.matchId}`;
      const tournamentId =
        envelope?.tournamentId || `official-live-tournament:${liveRow.matchId}`;

      const created = createOfficialCore16LiveScoringSession({
        tenantId,
        tournamentId,
        matchId: envelope?.matchId || liveRow.matchId,
        eventId: envelope?.eventId || null,
        targetScore: liveRow.targetScore,
        rulesEnvelope: envelope || {
          scoringSystem: SCORING_SYSTEM.RALLY,
          pointsToWin: Number(liveRow.targetScore) || 11,
          winBy: 2,
          sideSwitchAt: 11,
          serversPerSide: 1,
          initialServingSide: "SIDE_A",
        },
      });
      return created;
    },
    [rulesQuery]
  );

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

    const liveRow = mapOfficialLiveRow(result);
    applyRow(liveRow);

    const created = bootstrapCore16Session(liveRow);
    if (!created.ok) {
      setError(created.error || "Không khởi tạo CORE-16 scoring session.");
      setLoading(false);
      return;
    }

    // If classic live already has non-zero scores, refuse silent re-init drift.
    if (
      (Number(liveRow.scoreA) > 0 || Number(liveRow.scoreB) > 0) &&
      created.readModel.scoreA === 0 &&
      created.readModel.scoreB === 0
    ) {
      setMessage(
        "Live đã có điểm classic — CORE-16 session bắt đầu 0–0. Dùng Undo/chấm lại theo CORE-16 hoặc reload sau khi reset live."
      );
    }

    setSession(created);
    setLoading(false);
  }, [token, applyRow, bootstrapCore16Session]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  const handleRallyWon = async (team) => {
    if (locked || submitting || !session) return;
    setSubmitting(true);
    setError(null);

    const applied = applyOfficialCore16RallyOutcome(session, {
      team,
      expectedRevision: session.state?.revision,
    });
    if (!applied.ok) {
      setSubmitting(false);
      setError(applied.error || "CORE-16 từ chối ghi điểm.");
      return;
    }

    setSession(applied.session);

    // Compatibility projection to classic live row (demoted writer) when score changed.
    if (applied.scoreChanged === true) {
      const projected = await projectClassicLiveScores({
        token,
        fromA: scoreA,
        fromB: scoreB,
        toA: applied.readModel.scoreA,
        toB: applied.readModel.scoreB,
      });
      if (!projected.ok) {
        setError(
          projected.error ||
            "CORE-16 đã ghi điểm nhưng không chiếu được lên live classic (tải lại)."
        );
      } else {
        applyRow({
          ...row,
          scoreA: projected.scoreA,
          scoreB: projected.scoreB,
          liveRevision: projected.liveRevision,
          status: projected.status || MATCH_LIVE_STATUS.PLAYING,
        });
      }
    }

    setSubmitting(false);
    setMessage(null);
  };

  const handleUndo = async () => {
    if (locked || submitting || !session) return;
    setSubmitting(true);
    setError(null);
    const undone = undoOfficialCore16LastPoint(session, {});
    if (!undone.ok) {
      setSubmitting(false);
      setError(undone.error || "CORE-16 không hoàn tác được.");
      return;
    }
    setSession(undone.session);
    const projected = await projectClassicLiveScores({
      token,
      fromA: scoreA,
      fromB: scoreB,
      toA: undone.readModel.scoreA,
      toB: undone.readModel.scoreB,
    });
    if (!projected.ok) {
      setError(projected.error || "Hoàn tác CORE-16 ok nhưng chiếu live classic thất bại.");
    } else {
      applyRow({
        ...row,
        scoreA: projected.scoreA,
        scoreB: projected.scoreB,
        liveRevision: projected.liveRevision,
        status: projected.status || row?.status,
      });
    }
    setSubmitting(false);
  };

  const handleConfirmChangeEnds = () => {
    if (!session) return;
    const ack = confirmOfficialCore16ChangeEnds(session, {
      expectedRevision: session.state?.revision,
    });
    if (!ack.ok) {
      setError(ack.error || "Không xác nhận đổi sân.");
      return;
    }
    setSession(ack.session);
    setMessage("Đã xác nhận đổi sân (session ACK — chưa durable court SSOT).");
  };

  const handleConfirmFinalize = async () => {
    setConfirmFinalizeOpen(false);
    if (!session) return;
    const terminal = assertOfficialCore16TerminalForCommit(session);
    if (!terminal.ok) {
      setError(terminal.error || "CORE-16 chưa terminal.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await officialCommitMatchResultCommand({
      token,
      scoreA: terminal.scoreA,
      scoreB: terminal.scoreB,
      idempotencyKey: newOfficialLifecycleIdempotencyKey(`ref-${token.slice(-8)}`),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || REFEREE_LINK_LOCKED_MESSAGE);
      return;
    }

    applyRow({
      ...row,
      scoreA: result.scoreA ?? terminal.scoreA,
      scoreB: result.scoreB ?? terminal.scoreB,
      status: MATCH_LIVE_STATUS.PROCESSED,
      canonicalResult: {
        scoreA: result.scoreA ?? terminal.scoreA,
        scoreB: result.scoreB ?? terminal.scoreB,
        winnerName: result.winnerName || "",
        status: "completed",
      },
    });
    setLocked(true);
    setDone(true);
    setMessage(
      result.winnerName
        ? `CORE-16 terminal → đã chốt ${result.scoreA} — ${result.scoreB}. Thắng: ${result.winnerName}.`
        : `CORE-16 terminal → đã chốt ${result.scoreA} — ${result.scoreB} vào giải.`
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

  const canFinalize = Boolean(readModel?.matchComplete);
  const changeEndsDue = readModel?.sideChangeRequired === true;

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", pb: 4 }}>
      {!sessionMode && (
        <Container maxWidth="sm" sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            Bảng điểm trọng tài · CORE-16 canonical scoring (Adapter B binding).
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
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {!rulesQuery.ok && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Link chưa kèm CORE-16 rules query — đang dùng Rally + đích từ live row. Mở link từ
            phân công Official (có envelope) để Side-out / win-by đầy đủ.
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
            <Chip
              label={readModel?.scoringMethodLabel || row?.scoringMethodLabel || "Rally"}
              size="small"
            />
            {readModel?.targetPoints || row?.targetScore ? (
              <Chip
                label={`Đích ${readModel?.targetPoints || row.targetScore}`}
                size="small"
                color="info"
              />
            ) : null}
            {readModel?.winBy != null ? (
              <Chip label={`Win-by ${readModel.winBy}`} size="small" />
            ) : null}
            {readModel?.pointCap != null ? (
              <Chip label={`Cap ${readModel.pointCap}`} size="small" />
            ) : null}
            <Chip label={displayStatus} size="small" color={statusChipColor} />
            {readModel?.courtOrientation ? (
              <Chip
                label={`Hướng sân ${readModel.courtOrientation}`}
                size="small"
                variant="outlined"
              />
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {isSideOut
              ? "Side-out · bấm đội thắng rally (không phải +1 mù). Điểm chỉ cộng khi bên giao thắng."
              : "Rally · bấm đội thắng rally. Terminal do CORE-16 (win-by / point cap)."}
          </Typography>
          <Typography variant="h4" fontWeight="bold" sx={{ mt: 2 }}>
            {scoreA} — {scoreB}
          </Typography>
          {readModel?.matchComplete ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              CORE-16 terminal · thắng {readModel.calculatedWinnerTeam === "A" ? row?.entryALabel : row?.entryBLabel}
            </Alert>
          ) : null}
        </Paper>

        {changeEndsDue && !locked && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                startIcon={<SwapHorizIcon />}
                onClick={handleConfirmChangeEnds}
              >
                Xác nhận đổi sân
              </Button>
            }
          >
            Đến mốc đổi sân (change-end). Xác nhận trước khi ghi điểm tiếp.
          </Alert>
        )}

        {!locked && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TeamScoreControls
              label={row?.entryALabel || "Đội A"}
              score={scoreA}
              disabled={locked || submitting || changeEndsDue || readModel?.matchComplete}
              serving={readModel?.servingSideLabel === "A"}
              serverNumber={
                readModel?.servingSideLabel === "A" ? readModel?.serverNumber : null
              }
              rallyLabel={isSideOut ? "Thắng rally" : "+1 / thắng rally"}
              onRallyWon={() => handleRallyWon("A")}
            />
            <TeamScoreControls
              label={row?.entryBLabel || "Đội B"}
              score={scoreB}
              disabled={locked || submitting || changeEndsDue || readModel?.matchComplete}
              serving={readModel?.servingSideLabel === "B"}
              serverNumber={
                readModel?.servingSideLabel === "B" ? readModel?.serverNumber : null
              }
              rallyLabel={isSideOut ? "Thắng rally" : "+1 / thắng rally"}
              onRallyWon={() => handleRallyWon("B")}
            />
          </Stack>
        )}

        {!locked && (
          <Stack spacing={1.25} sx={{ mb: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              disabled={submitting || !session?.actionLedger?.length}
              startIcon={<UndoIcon />}
              onClick={handleUndo}
              sx={{ minHeight: 48 }}
            >
              Undo (CORE-16 SUPERSEDE)
            </Button>
            <Button
              fullWidth
              size="large"
              variant="contained"
              color="success"
              disabled={submitting || !canFinalize}
              onClick={() => setConfirmFinalizeOpen(true)}
              sx={{ minHeight: 56, fontSize: "1.05rem", fontWeight: 700 }}
            >
              Chốt kết quả (CORE-16 terminal)
            </Button>
          </Stack>
        )}

        {locked && row?.canonicalResult && (
          <Alert severity="success">
            Kết quả chính thức: {row.canonicalResult.scoreA} — {row.canonicalResult.scoreB}
            {row.canonicalResult.winnerName ? ` · Thắng: ${row.canonicalResult.winnerName}` : ""}.
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
            CORE-16 đã terminal. Chốt vào giải (CORE-15/17 compatibility commit path)?
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
    </Box>
  );
}
