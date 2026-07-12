import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

import { validateOverrideReason } from "../../../features/team-tournament/engines/overrideLineupWorkflowEngine.js";
import { validateLineupSelectionsStructured } from "../../../features/team-tournament/engines/lineupValidationEngine.js";

function playerName(players, playerId) {
  return players.find((p) => p.id === playerId)?.name || playerId || "—";
}

function summarizeSelections(selections, disciplines, players) {
  if (!selections || typeof selections !== "object") {
    return "—";
  }
  return disciplines
    .map((discipline) => {
      const ids = selections[discipline.id] || [];
      if (!ids.length) {
        return `${discipline.name}: —`;
      }
      return `${discipline.name}: ${ids.map((id) => playerName(players, id)).join(", ")}`;
    })
    .join("\n");
}

export default function TeamLineupOverrideDialog({
  open,
  onClose,
  team,
  teamData,
  matchup,
  lineup,
  players = [],
  overrideOps = null,
  busy = false,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const [selections, setSelections] = useState(() => ({ ...(lineup?.selections || {}) }));
  const [localError, setLocalError] = useState("");

  const elevatedReasonRequired = overrideOps?.elevatedReasonRequired === true;
  const operationalWarning = overrideOps?.operationalWarning || null;
  const beforeSummary = useMemo(
    () => summarizeSelections(lineup?.selections, teamData?.disciplines || [], players),
    [lineup?.selections, teamData?.disciplines, players]
  );
  const afterSummary = useMemo(
    () => summarizeSelections(selections, teamData?.disciplines || [], players),
    [selections, teamData?.disciplines, players]
  );

  const handlePlayerChange = (disciplineId, slotIndex, playerId, playerCount) => {
    setSelections((prev) => {
      const next = { ...prev, [disciplineId]: [...(prev[disciplineId] || [])] };
      while (next[disciplineId].length < playerCount) {
        next[disciplineId].push("");
      }
      next[disciplineId][slotIndex] = playerId;
      return next;
    });
  };

  const handleSubmit = async () => {
    setLocalError("");
    const reasonCheck = validateOverrideReason(reason, { elevatedReasonRequired });
    if (!reasonCheck.ok) {
      setLocalError(reasonCheck.error);
      return;
    }

    const validation = validateLineupSelectionsStructured({
      teamData,
      teamId: team?.id,
      matchupId: matchup?.id,
      selections,
      isSubmit: true,
    });
    if (!validation.ok) {
      setLocalError(validation.error || "Lineup không hợp lệ.");
      return;
    }

    await onConfirm?.({
      reason: reasonCheck.reason,
      selections,
    });
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Thay đổi lineup — {team?.name || team?.id}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {operationalWarning ? <Alert severity="warning">{operationalWarning}</Alert> : null}
          {localError ? <Alert severity="error">{localError}</Alert> : null}
          <Typography variant="subtitle2">Trước override</Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {beforeSummary}
          </Typography>
          <Typography variant="subtitle2">Sau override (dự kiến)</Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {afterSummary}
          </Typography>
          {(teamData?.disciplines || []).map((discipline) => {
            const slots = Array.from({ length: discipline.playerCount }, (_, index) => index);
            const selectedIds = Array.from({ length: discipline.playerCount }, (_, index) =>
              selections[discipline.id]?.[index] || ""
            );
            const rosterIds = team?.playerIds || [];
            const eligible = players.filter((p) => rosterIds.includes(p.id));
            return (
              <BoxDisciplineEditor
                key={discipline.id}
                discipline={discipline}
                slots={slots}
                selectedIds={selectedIds}
                eligible={eligible}
                players={players}
                disabled={busy}
                onChange={handlePlayerChange}
              />
            );
          })}
          <TextField
            label="Lý do override *"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            disabled={busy}
            helperText={
              elevatedReasonRequired
                ? "Matchup đã bắt đầu — tối thiểu 15 ký tự."
                : "Bắt buộc ghi rõ lý do thay đổi."
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button
          variant="contained"
          color="warning"
          startIcon={<EditIcon />}
          onClick={handleSubmit}
          disabled={busy}
        >
          Xác nhận override
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BoxDisciplineEditor({
  discipline,
  slots,
  selectedIds,
  eligible,
  players,
  disabled,
  onChange,
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{discipline.name}</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {slots.map((slotIndex) => (
          <FormControl key={`${discipline.id}-${slotIndex}`} size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{`VĐV ${slotIndex + 1}`}</InputLabel>
            <Select
              label={`VĐV ${slotIndex + 1}`}
              value={selectedIds[slotIndex] || ""}
              disabled={disabled}
              onChange={(event) =>
                onChange(discipline.id, slotIndex, event.target.value, discipline.playerCount)
              }
            >
              <MenuItem value="">
                <em>— Chọn —</em>
              </MenuItem>
              {eligible.map((player) => (
                <MenuItem key={player.id} value={player.id}>
                  {player.name}
                </MenuItem>
              ))}
              {selectedIds[slotIndex] &&
              !eligible.some((player) => player.id === selectedIds[slotIndex]) ? (
                <MenuItem value={selectedIds[slotIndex]}>
                  {playerName(players, selectedIds[slotIndex])}
                </MenuItem>
              ) : null}
            </Select>
          </FormControl>
        ))}
      </Stack>
    </Stack>
  );
}
