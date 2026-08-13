import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { buildOfficialDrawBlockMessage } from "../../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  getOfficialCompetitionSettings,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_LABELS,
} from "../../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { projectOfficialDrawSubsteps } from "../../../features/individual-tournament/engines/officialDrawOrchestrationEngine.js";
import { OFFICIAL_MODE } from "../../../models/tournament/constants.js";

function SubstepChip({ label, state }) {
  const color =
    state === "complete" ? "success" : state === "current" ? "primary" : "default";
  const text =
    state === "complete"
      ? `${label}: hoàn tất`
      : state === "current"
        ? `${label}: hiện tại`
        : state === "ready"
          ? `${label}: sẵn sàng`
          : `${label}: khóa`;
  return <Chip size="small" color={color} variant={state === "locked" ? "outlined" : "filled"} label={text} />;
}

function PairList({ pairs = [], playersById }) {
  if (!pairs.length) return null;
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" fontWeight={700}>
        Danh sách cặp đã ghép
      </Typography>
      {pairs.map((pair, index) => {
        const ids = pair.playerIds || [];
        const a =
          playersById.get(String(ids[0]))?.name ||
          pair.name?.split("/")[0]?.trim() ||
          ids[0] ||
          "—";
        const b =
          playersById.get(String(ids[1]))?.name ||
          pair.name?.split("/")[1]?.trim() ||
          ids[1] ||
          "—";
        const rating =
          pair.rating != null && pair.rating !== "" ? ` · trình độ ${pair.rating}` : "";
        return (
          <Paper key={pair.id || index} variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="body2" fontWeight={700}>
              CẶP {index + 1}
            </Typography>
            <Typography variant="body2">
              {a} · {b}
              {rating}
            </Typography>
          </Paper>
        );
      })}
    </Stack>
  );
}

/**
 * Draw stage: individual = explicit pairing then group draw; pair = group draw only.
 */
export default function OfficialTournamentDrawScreen({
  tournament,
  eventId = "",
  groupCount = 1,
  players = [],
  canManage = true,
  pairBusy = false,
  groupBusy = false,
  onFormPairs,
  onGroupDraw,
}) {
  const competition = useMemo(() => getOfficialCompetitionSettings(tournament), [tournament]);
  const sub = useMemo(
    () => projectOfficialDrawSubsteps(tournament, eventId),
    [tournament, eventId]
  );
  const entries =
    tournament?.events?.find((e) => String(e.id) === String(eventId))?.entries ||
    tournament?.events?.[0]?.entries ||
    [];
  const gate = buildOfficialDrawBlockMessage(entries, tournament, 2);
  const isIndividual = competition.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL;
  const strategy =
    tournament?.officialMode === OFFICIAL_MODE.AI_BALANCE
      ? "AI Balance (seed/rating)"
      : "Open (random có điều kiện)";
  const [localError, setLocalError] = useState(null);
  const playersById = useMemo(
    () => new Map((players || []).map((player) => [String(player.id), player])),
    [players]
  );

  const pairingState = !isIndividual || sub.singlesContent
    ? "complete"
    : sub.groupsCreated || sub.pairingComplete
      ? "complete"
      : sub.pairingRequired
        ? "current"
        : "locked";
  const groupState = sub.groupsCreated
    ? "complete"
    : sub.groupDrawReady
      ? isIndividual && pairingState === "current"
        ? "locked"
        : "ready"
      : "locked";

  const handleFormPairs = async () => {
    setLocalError(null);
    if (!gate.ok) {
      setLocalError(gate.error);
      return;
    }
    const result = await onFormPairs?.();
    if (result && result.ok === false) {
      setLocalError(result.error || "Ghép cặp thất bại.");
    }
  };

  const handleGroupDraw = async () => {
    setLocalError(null);
    if (!sub.groupDrawReady) {
      setLocalError("Chưa sẵn sàng chia bảng.");
      return;
    }
    const result = await onGroupDraw?.();
    if (result && result.ok === false) {
      setLocalError(result.error || "Chia bảng thất bại.");
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip
          color="primary"
          label={OFFICIAL_REGISTRATION_MODE_LABELS[competition.registrationMode]}
        />
        <Chip label={strategy} variant="outlined" />
        <Chip label={`${sub.eligibleCount} đủ điều kiện`} />
        <Chip label={`${groupCount} bảng`} />
      </Stack>

      {isIndividual && !sub.singlesContent ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <SubstepChip label="GHÉP CẶP" state={pairingState} />
          <SubstepChip label="CHIA BẢNG" state={groupState} />
        </Stack>
      ) : (
        <Typography variant="body2">
          {isIndividual
            ? "Nội dung đơn — chia bảng từ VĐV đã chốt."
            : "Cặp đã cố định — chỉ chia bảng, không tách cặp."}
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary">
        {sub.summary}
      </Typography>

      {!gate.ok ? <Alert severity="warning">{gate.error}</Alert> : null}
      {localError ? <Alert severity="error">{localError}</Alert> : null}

      {isIndividual && !sub.singlesContent && sub.pairingRequired ? (
        <Alert severity="info">
          {sub.individualCount} VĐV đủ điều kiện. Ghép cặp trước — chưa chia bảng.
        </Alert>
      ) : null}

      {sub.pairingComplete && !sub.groupsCreated && sub.formedPairs.length > 0 ? (
        <PairList pairs={sub.formedPairs} playersById={playersById} />
      ) : null}

      {isIndividual && !sub.singlesContent && sub.pairingRequired ? (
        <Button
          variant="contained"
          size="large"
          disabled={!canManage || !gate.ok || pairBusy}
          onClick={handleFormPairs}
        >
          {pairBusy ? "Đang ghép cặp..." : "Bắt đầu ghép cặp"}
        </Button>
      ) : null}

      {sub.groupDrawReady ? (
        <Button
          variant="contained"
          size="large"
          disabled={!canManage || groupBusy}
          onClick={handleGroupDraw}
        >
          {groupBusy ? "Đang chia bảng..." : "Chia bảng"}
        </Button>
      ) : null}

      {sub.groupsCreated ? (
        <Alert severity="success">Đã chia {sub.groupCount} bảng.</Alert>
      ) : null}
    </Stack>
  );
}
