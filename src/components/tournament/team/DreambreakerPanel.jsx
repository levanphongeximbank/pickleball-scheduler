import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import UndoIcon from "@mui/icons-material/Undo";
import LockIcon from "@mui/icons-material/Lock";

import { DREAMBREAKER_ORDER_SOURCE, DREAMBREAKER_STATUS } from "../../../features/team-tournament/constants.js";
import { getDreambreakerCourtPlayers } from "../../../features/team-tournament/engines/dreambreakerEngine.js";
import { findTeam } from "../../../features/team-tournament/models/index.js";
import { formatTeamTournamentDateTime, formatCountdownTo } from "./teamTournamentLabels.js";

const CAPTAIN_DB_STEPS = [
  "Nộp thứ tự",
  "Chờ đối thủ",
  "Trọng tài bắt đầu",
  "Đang đấu / Xong",
];

function getCaptainDreambreakerStep(dreambreaker, teamId, matchup) {
  if (!dreambreaker) {
    return 0;
  }

  const isTeamA = teamId === matchup.teamAId;
  const order = isTeamA ? dreambreaker.teamAOrder : dreambreaker.teamBOrder;

  if (dreambreaker.status === DREAMBREAKER_STATUS.COMPLETED) {
    return 3;
  }
  if (dreambreaker.status === DREAMBREAKER_STATUS.IN_PROGRESS) {
    return 3;
  }
  if (dreambreaker.status === DREAMBREAKER_STATUS.READY) {
    return 2;
  }
  if (order.length === 4) {
    return 1;
  }
  return 0;
}

function OrderPicker({ team, players, order, onChange, disabled }) {
  const slots = [0, 1, 2, 3];

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" fontWeight={700}>
        {team.name} — thứ tự 1→4
      </Typography>
      {slots.map((slot) => (
        <Stack key={slot} direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={`#${slot + 1}`} />
          <select
            disabled={disabled}
            value={order[slot] || ""}
            onChange={(event) => {
              const next = [...order];
              next[slot] = event.target.value;
              onChange(next);
            }}
            style={{ flex: 1, padding: 8, borderRadius: 8 }}
          >
            <option value="">Chọn VĐV</option>
            {team.playerIds.map((playerId) => (
              <option key={playerId} value={playerId}>
                {players.find((item) => item.id === playerId)?.name || playerId}
              </option>
            ))}
          </select>
        </Stack>
      ))}
    </Stack>
  );
}

export function CaptainDreambreakerPanel({
  matchup,
  teamData,
  teamId,
  players = [],
  opponentName = "",
  onSubmit,
  busy,
}) {
  const dreambreaker = matchup.dreambreaker;
  const isTeamA = teamId === matchup.teamAId;
  const currentOrder = isTeamA
    ? dreambreaker?.teamAOrder || []
    : dreambreaker?.teamBOrder || [];
  const orderSource = isTeamA ? dreambreaker?.orderSourceA : dreambreaker?.orderSourceB;
  const [order, setOrder] = useState(
    currentOrder.length === 4 ? currentOrder : ["", "", "", ""]
  );

  const team = findTeam(teamData, teamId);
  const activeStep = getCaptainDreambreakerStep(dreambreaker, teamId, matchup);
  const orderLockCountdown = dreambreaker?.orderLockAt
    ? formatCountdownTo(dreambreaker.orderLockAt)
    : null;
  const ordersLocked = Boolean(dreambreaker?.ordersLockedAt);
  const canSubmitOrder =
    !ordersLocked &&
    dreambreaker.status === DREAMBREAKER_STATUS.LINEUP_OPEN &&
    currentOrder.length !== 4;

  if (!team) {
    return null;
  }

  if (!dreambreaker) {
    return (
      <Alert severity="warning">
        Tie hòa 2–2 — chờ hệ thống kích hoạt Dreambreaker. Làm mới trang hoặc liên hệ BTC nếu
        không thấy form nộp thứ tự.
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
        Dreambreaker — trận quyết định (đấu đơn luân lưu)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {team.name} vs {opponentName || "đối thủ"}
      </Typography>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
        {CAPTAIN_DB_STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {dreambreaker.orderLockAt ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Hạn nộp thứ tự: {formatTeamTournamentDateTime(dreambreaker.orderLockAt)}
          {orderLockCountdown ? ` (${orderLockCountdown})` : ""}
        </Typography>
      ) : null}

      {orderSource === DREAMBREAKER_ORDER_SOURCE.RANDOM ? (
        <Chip size="small" color="warning" label="Tự động sắp xếp" sx={{ mb: 1.5 }} />
      ) : null}

      {ordersLocked && currentOrder.length !== 4 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          BTC đã khóa thứ tự Dreambreaker
          {orderSource === DREAMBREAKER_ORDER_SOURCE.RANDOM
            ? " — hệ thống đã tự sắp xếp cho đội bạn."
            : " — không thể nộp thêm."}
        </Alert>
      ) : null}

      {dreambreaker.status !== DREAMBREAKER_STATUS.LINEUP_OPEN &&
      dreambreaker.status !== DREAMBREAKER_STATUS.READY ? (
        <Alert severity="info">
          Thứ tự Dreambreaker:{" "}
          {currentOrder
            .map((id) => players.find((player) => player.id === id)?.name || id)
            .join(" → ")}
        </Alert>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            Chọn thứ tự 4 VĐV (1→4). Mỗi cặp đánh đúng 4 điểm rồi xoay vòng. Quá hạn hệ thống tự
            sắp xếp.
          </Alert>
          <OrderPicker
            team={team}
            players={players}
            order={order}
            onChange={setOrder}
            disabled={busy || !canSubmitOrder}
          />
          {currentOrder.length === 4 ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Đã nộp thứ tự. Chờ đối thủ
              {dreambreaker.status === DREAMBREAKER_STATUS.READY
                ? " — trọng tài sẽ bắt đầu Dreambreaker."
                : "."}
            </Alert>
          ) : (
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              disabled={busy || !canSubmitOrder || order.filter(Boolean).length !== 4}
              onClick={() => onSubmit(order)}
            >
              Nộp thứ tự Dreambreaker
            </Button>
          )}
        </>
      )}
    </Paper>
  );
}

export function RefereeDreambreakerPanel({
  matchup,
  teamData,
  players = [],
  onPoint,
  onUndo,
  onStart,
  onLock,
  onInjury,
  busy,
}) {
  const dreambreaker = matchup.dreambreaker;
  const court = useMemo(
    () => getDreambreakerCourtPlayers(matchup, teamData),
    [matchup, teamData]
  );

  if (!dreambreaker) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Tie hòa 2–2 — Dreambreaker chưa kích hoạt. Xác nhận đủ 4 trận đôi hoặc dùng «Đồng bộ
        Dreambreaker» trên trang setup giải.
      </Alert>
    );
  }

  const teamA = findTeam(teamData, matchup.teamAId);
  const teamB = findTeam(teamData, matchup.teamBId);
  const playerName = (id) => players.find((player) => player.id === id)?.name || id;

  if (dreambreaker.status === DREAMBREAKER_STATUS.LINEUP_OPEN) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Chờ hai đội nộp thứ tự Dreambreaker (A: {dreambreaker.teamAOrder.length}/4, B:{" "}
          {dreambreaker.teamBOrder.length}/4).
          {dreambreaker.orderLockAt
            ? ` Hạn: ${formatTeamTournamentDateTime(dreambreaker.orderLockAt)} — quá hạn tự sắp xếp.`
            : ""}
        </Alert>
        {!dreambreaker.ordersLockedAt ? (
          <Button
            variant="outlined"
            startIcon={<LockIcon />}
            onClick={onLock}
            disabled={busy || !onLock}
          >
            Khóa thứ tự
          </Button>
        ) : (
          <Chip size="small" color="warning" label="Đã khóa thứ tự" />
        )}
      </Box>
    );
  }

  if (dreambreaker.status === DREAMBREAKER_STATUS.READY) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Dreambreaker sẵn sàng
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Cả hai đội đã có thứ tự 4 VĐV. Bấm bắt đầu để ghi điểm rally.
        </Typography>
        <Button variant="contained" onClick={onStart} disabled={busy || !onStart}>
          Bắt đầu Dreambreaker
        </Button>
      </Paper>
    );
  }

  if (dreambreaker.status === DREAMBREAKER_STATUS.COMPLETED) {
    return (
      <Alert severity="success" sx={{ mt: 2 }}>
        Dreambreaker kết thúc: {teamA?.name} {dreambreaker.teamAScore}–
        {dreambreaker.teamBScore} {teamB?.name}
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" fontWeight={700}>
          Dreambreaker — điểm tập thể
        </Typography>
        <Chip
          label={`Lượt ${(court.segmentIndex % 4) + 1}: ${playerName(court.teamAPlayerId)} vs ${playerName(court.teamBPlayerId)}`}
          color="primary"
          variant="outlined"
        />
        <Typography variant="h4" fontWeight={800} textAlign="center">
          {dreambreaker.teamAScore} – {dreambreaker.teamBScore}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            fullWidth
            variant="contained"
            disabled={busy || !onPoint}
            onClick={() => onPoint?.(matchup.teamAId)}
          >
            +1 {teamA?.name}
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            disabled={busy || !onPoint}
            onClick={() => onPoint?.(matchup.teamBId)}
          >
            +1 {teamB?.name}
          </Button>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<UndoIcon />} variant="outlined" disabled={busy || !onUndo} onClick={onUndo}>
            Hoàn tác
          </Button>
          <Button
            variant="outlined"
            color="warning"
            disabled={busy || !onInjury}
            onClick={() => {
              const injuredId = window.prompt("ID VĐV bị chấn thương:");
              if (injuredId) {
                const teamId = window.prompt("ID đội (teamA/teamB id):");
                if (teamId) {
                  onInjury({ teamId, injuredPlayerId: injuredId.trim() });
                }
              }
            }}
          >
            Chấn thương
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Rally đến 21, cách 2, Freeze @20 · Đổi sân khi tổng điểm = 20 · Xoay 4 điểm/lượt
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function DreambreakerPanel(props) {
  if (props.mode === "captain") {
    return <CaptainDreambreakerPanel {...props} />;
  }
  return <RefereeDreambreakerPanel {...props} />;
}
