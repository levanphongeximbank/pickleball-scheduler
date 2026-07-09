import { useMemo, useState } from "react";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

import { INTERVENTION_TYPE } from "../constants.js";
import {
  dissolveEntry,
  movePlayerToEntry,
  swapPlayersBetweenEntries,
} from "../engines/entryInterventionEngine.js";
import SuperAdminInterventionBanner from "./SuperAdminInterventionBanner.jsx";
import { InterventionFeedbackSnackbar } from "./InterventionFeedback.jsx";

function resolveEntryPlayers(entry, playersById) {
  return (entry.playerIds || [])
    .map((id) => playersById.get(String(id)))
    .filter(Boolean);
}

function playerSelectionState(playerId, swapSource, swapTarget) {
  const key = String(playerId);
  if (swapSource.playerId === key) {
    return "source";
  }
  if (swapTarget.playerId === key) {
    return "target";
  }
  return "none";
}

export default function TournamentEntryEditor({
  entries = [],
  players = [],
  eventType,
  canIntervene = false,
  onApply,
  onAudit,
  tournamentId = "",
  eventId = "",
  defaultExpanded = false,
}) {
  const [localError, setLocalError] = useState(null);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [swapSource, setSwapSource] = useState({ entryId: "", playerId: "" });
  const [swapTarget, setSwapTarget] = useState({ entryId: "", playerId: "" });
  const [moveSource, setMoveSource] = useState({ playerId: "", fromEntryId: "" });
  const [moveTargetEntryId, setMoveTargetEntryId] = useState("");
  const [feedback, setFeedback] = useState({ open: false, message: "" });

  const playersById = useMemo(
    () => new Map(players.map((player) => [String(player.id), player])),
    [players]
  );

  if (!canIntervene || entries.length === 0) {
    return null;
  }

  const showFeedback = (message) => {
    setFeedback({ open: true, message });
  };

  const applyResult = async (result, interventionType, successMessage) => {
    if (!result.ok) {
      setLocalError(result.errors?.join(" ") || "Không thể áp dụng thay đổi.");
      return;
    }

    setLocalError(null);
    if (onAudit) {
      await onAudit({
        interventionType,
        before: entries,
        after: result.entries,
      });
    }
    onApply?.(result);
    showFeedback(successMessage);
  };

  const withUndo = (runner) => {
    setUndoSnapshot(entries);
    runner();
  };

  const handleSelectPlayerForSwap = (entryId, playerId) => {
    const key = String(playerId);
    if (swapSource.playerId === key) {
      setSwapSource({ entryId: "", playerId: "" });
      return;
    }
    if (swapTarget.playerId === key) {
      setSwapTarget({ entryId: "", playerId: "" });
      return;
    }
    if (!swapSource.playerId) {
      setSwapSource({ entryId, playerId: key });
      return;
    }
    if (!swapTarget.playerId) {
      setSwapTarget({ entryId, playerId: key });
      return;
    }
    setSwapSource({ entryId, playerId: key });
    setSwapTarget({ entryId: "", playerId: "" });
  };

  const handleSwap = () => {
    if (!swapSource.playerId || !swapTarget.playerId) {
      setLocalError("Chọn 2 VĐV (nguồn và đích) để hoán đổi.");
      return;
    }

    withUndo(() => {
      const result = swapPlayersBetweenEntries(
        entries,
        {
          entryIdA: swapSource.entryId,
          playerIdA: swapSource.playerId,
          entryIdB: swapTarget.entryId,
          playerIdB: swapTarget.playerId,
        },
        players,
        eventType
      );
      applyResult(result, INTERVENTION_TYPE.ENTRY_SWAP, "Đã hoán đổi VĐV giữa 2 cặp.");
      if (result.ok) {
        setSwapSource({ entryId: "", playerId: "" });
        setSwapTarget({ entryId: "", playerId: "" });
      }
    });
  };

  const handleMove = () => {
    if (!moveSource.playerId || !moveSource.fromEntryId || !moveTargetEntryId) {
      setLocalError("Chọn VĐV nguồn và cặp/đội đích.");
      return;
    }

    withUndo(() => {
      const result = movePlayerToEntry(
        entries,
        {
          playerId: moveSource.playerId,
          fromEntryId: moveSource.fromEntryId,
          toEntryId: moveTargetEntryId,
        },
        players,
        eventType
      );
      applyResult(result, INTERVENTION_TYPE.ENTRY_MOVE, "Đã chuyển VĐV sang cặp/đội khác.");
    });
  };

  const handleDissolve = (entryId) => {
    withUndo(() => {
      const result = dissolveEntry(entries, entryId, players, eventType, {
        tournamentId,
        eventId,
      });
      applyResult(result, INTERVENTION_TYPE.ENTRY_DISSOLVE, "Đã giải tán cặp/đội.");
    });
  };

  const handleUndo = () => {
    if (!undoSnapshot) {
      return;
    }
    onApply?.({ ok: true, entries: undoSnapshot, warnings: [] });
    setUndoSnapshot(null);
    setLocalError(null);
    showFeedback("Đã hoàn tác thay đổi ghép cặp.");
  };

  return (
    <>
      <Accordion
        defaultExpanded={defaultExpanded}
        disableGutters
        sx={{
          mt: 1.5,
          border: 1,
          borderColor: "warning.main",
          "&:before": { display: "none" },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "warning.50" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AdminPanelSettingsIcon fontSize="small" color="warning" />
            <Typography fontWeight="bold">Can thiệp ghép cặp (Super Admin)</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1.5 }}>
          <SuperAdminInterventionBanner
            canUndo={Boolean(undoSnapshot)}
            onUndo={handleUndo}
            message="Chọn VĐV A → VĐV B → Hoán đổi. Hoặc chuyển VĐV sang cặp khác."
          />

          {localError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {localError}
            </Alert>
          )}

          {(swapSource.playerId || swapTarget.playerId) && (
            <Alert severity="info" sx={{ mb: 1 }}>
              {swapSource.playerId
                ? `VĐV A: ${playersById.get(swapSource.playerId)?.name || swapSource.playerId}`
                : "Chưa chọn VĐV A"}
              {" — "}
              {swapTarget.playerId
                ? `VĐV B: ${playersById.get(swapTarget.playerId)?.name || swapTarget.playerId}`
                : "Chưa chọn VĐV B"}
            </Alert>
          )}

          <Stack spacing={1}>
            {entries.map((entry) => {
              const members = resolveEntryPlayers(entry, playersById);
              return (
                <Paper key={entry.id} variant="outlined" sx={{ p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {entry.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {members.map((player) => player.name).join(" • ")}
                      </Typography>
                    </Box>
                    <Button size="small" color="warning" onClick={() => handleDissolve(entry.id)}>
                      Giải tán
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                    {members.map((player) => {
                      const selection = playerSelectionState(
                        player.id,
                        swapSource,
                        swapTarget
                      );
                      return (
                        <Button
                          key={player.id}
                          size="small"
                          variant={selection === "none" ? "outlined" : "contained"}
                          color={
                            selection === "target"
                              ? "secondary"
                              : selection === "source"
                                ? "warning"
                                : "inherit"
                          }
                          onClick={() => handleSelectPlayerForSwap(entry.id, player.id)}
                        >
                          {selection === "source"
                            ? "A: "
                            : selection === "target"
                              ? "B: "
                              : ""}
                          {player.name}
                        </Button>
                      );
                    })}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
            <Button
              variant="contained"
              color="warning"
              onClick={handleSwap}
              disabled={!swapSource.playerId || !swapTarget.playerId}
            >
              Hoán đổi VĐV A ↔ B
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>VĐV chuyển</InputLabel>
              <Select
                label="VĐV chuyển"
                value={moveSource.playerId}
                onChange={(event) => {
                  const playerId = event.target.value;
                  const fromEntry = entries.find((entry) =>
                    (entry.playerIds || []).some((id) => String(id) === String(playerId))
                  );
                  setMoveSource({
                    playerId,
                    fromEntryId: fromEntry?.id || "",
                  });
                }}
              >
                {entries.flatMap((entry) =>
                  (entry.playerIds || []).map((playerId) => {
                    const player = playersById.get(String(playerId));
                    if (!player) {
                      return null;
                    }
                    return (
                      <MenuItem key={playerId} value={String(playerId)}>
                        {player.name} ({entry.name})
                      </MenuItem>
                    );
                  })
                )}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Cặp/đội đích</InputLabel>
              <Select
                label="Cặp/đội đích"
                value={moveTargetEntryId}
                onChange={(event) => setMoveTargetEntryId(event.target.value)}
              >
                {entries.map((entry) => (
                  <MenuItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button variant="outlined" color="warning" onClick={handleMove}>
              Chuyển VĐV
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <InterventionFeedbackSnackbar
        open={feedback.open}
        message={feedback.message}
        onClose={() => setFeedback({ open: false, message: "" })}
      />
    </>
  );
}
