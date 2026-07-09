import { useState } from "react";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  Grid,
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
  moveEntryBetweenGroups,
  swapEntriesBetweenGroups,
} from "../engines/groupInterventionEngine.js";
import SuperAdminInterventionBanner from "./SuperAdminInterventionBanner.jsx";
import { InterventionFeedbackSnackbar } from "./InterventionFeedback.jsx";

export default function TournamentGroupEditor({
  groups = [],
  entries = [],
  players = [],
  canIntervene = false,
  onApply,
  onAudit,
  tournamentId = "",
  eventId = "",
  defaultExpanded = false,
}) {
  const [localError, setLocalError] = useState(null);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [moveEntryId, setMoveEntryId] = useState("");
  const [moveFromGroupId, setMoveFromGroupId] = useState("");
  const [moveToGroupId, setMoveToGroupId] = useState("");
  const [swapEntryA, setSwapEntryA] = useState("");
  const [swapGroupA, setSwapGroupA] = useState("");
  const [swapEntryB, setSwapEntryB] = useState("");
  const [swapGroupB, setSwapGroupB] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [feedback, setFeedback] = useState({ open: false, message: "" });

  if (!canIntervene || groups.length === 0) {
    return null;
  }

  const scheduleOptions = { tournamentId, eventId, players };

  const showFeedback = (message) => {
    setFeedback({ open: true, message });
  };

  const applyResult = async (result, interventionType, successMessage) => {
    if (!result.ok) {
      setLocalError(result.errors?.join(" ") || "Không thể áp dụng thay đổi bảng.");
      return;
    }

    setLocalError(null);
    if (onAudit) {
      await onAudit({
        interventionType,
        before: { groups, entries },
        after: { groups: result.groups, entries: result.entries },
      });
    }
    onApply?.(result);
    showFeedback(successMessage);
  };

  const withUndo = (runner) => {
    setUndoSnapshot({ groups, entries, matches: groups.flatMap((g) => g.matches || []) });
    runner();
  };

  const runMove = () => {
    withUndo(() => {
      const result = moveEntryBetweenGroups(
        groups,
        {
          entryId: moveEntryId,
          fromGroupId: moveFromGroupId,
          toGroupId: moveToGroupId,
        },
        entries,
        players,
        scheduleOptions
      );
      applyResult(
        result,
        INTERVENTION_TYPE.GROUP_MOVE,
        "Đã di chuyển đội — lịch vòng bảng được tạo lại."
      );
    });
  };

  const runSwap = () => {
    withUndo(() => {
      const result = swapEntriesBetweenGroups(
        groups,
        {
          entryIdA: swapEntryA,
          groupIdA: swapGroupA,
          entryIdB: swapEntryB,
          groupIdB: swapGroupB,
        },
        entries,
        players,
        scheduleOptions
      );
      applyResult(
        result,
        INTERVENTION_TYPE.GROUP_SWAP,
        "Đã hoán đổi 2 đội — lịch vòng bảng được tạo lại."
      );
    });
  };

  const requestMove = () => {
    if (!moveEntryId || !moveFromGroupId || !moveToGroupId) {
      setLocalError("Chọn đội, bảng nguồn và bảng đích.");
      return;
    }
    setLocalError(null);
    setConfirmAction("move");
  };

  const requestSwap = () => {
    if (!swapEntryA || !swapGroupA || !swapEntryB || !swapGroupB) {
      setLocalError("Chọn 2 đội và 2 bảng để hoán đổi.");
      return;
    }
    setLocalError(null);
    setConfirmAction("swap");
  };

  const handleConfirm = () => {
    if (confirmAction === "move") {
      runMove();
    } else if (confirmAction === "swap") {
      runSwap();
    }
    setConfirmAction(null);
  };

  const handleUndo = () => {
    if (!undoSnapshot) {
      return;
    }
    onApply?.({
      ok: true,
      entries: undoSnapshot.entries,
      groups: undoSnapshot.groups,
      matches: undoSnapshot.matches || [],
      warnings: [],
    });
    setUndoSnapshot(null);
    setLocalError(null);
    showFeedback("Đã hoàn tác thay đổi chia bảng.");
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
            <Typography fontWeight="bold">Can thiệp chia bảng (Super Admin)</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1.5 }}>
          <SuperAdminInterventionBanner
            canUndo={Boolean(undoSnapshot)}
            onUndo={handleUndo}
            message="Di chuyển đội giữa các bảng — lịch vòng bảng sẽ được tạo lại."
          />

          {localError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {localError}
            </Alert>
          )}

          <Grid container spacing={1} sx={{ mb: 1.5 }}>
            {groups.map((group) => (
              <Grid key={group.id} size={{ xs: 12, sm: 6 }}>
                <Paper variant="outlined" sx={{ p: 1, height: "100%" }}>
                  <Typography variant="body2" fontWeight="bold">
                    {group.name || `Bảng ${group.label}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {(group.entries || []).map((entry) => entry.name).join(" | ") || "Chưa có đội"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.entryIds?.length || 0} đội • {group.matches?.length || 0} trận
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
            Di chuyển đội
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Đội</InputLabel>
              <Select label="Đội" value={moveEntryId} onChange={(e) => setMoveEntryId(e.target.value)}>
                {entries.map((entry) => (
                  <MenuItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Từ bảng</InputLabel>
              <Select
                label="Từ bảng"
                value={moveFromGroupId}
                onChange={(e) => setMoveFromGroupId(e.target.value)}
              >
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name || group.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Sang bảng</InputLabel>
              <Select
                label="Sang bảng"
                value={moveToGroupId}
                onChange={(e) => setMoveToGroupId(e.target.value)}
              >
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name || group.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button variant="contained" color="warning" onClick={requestMove}>
              Di chuyển đội
            </Button>
          </Stack>

          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
            Hoán đổi 2 đội
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Đội A</InputLabel>
              <Select label="Đội A" value={swapEntryA} onChange={(e) => setSwapEntryA(e.target.value)}>
                {entries.map((entry) => (
                  <MenuItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Bảng A</InputLabel>
              <Select label="Bảng A" value={swapGroupA} onChange={(e) => setSwapGroupA(e.target.value)}>
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Đội B</InputLabel>
              <Select label="Đội B" value={swapEntryB} onChange={(e) => setSwapEntryB(e.target.value)}>
                {entries.map((entry) => (
                  <MenuItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Bảng B</InputLabel>
              <Select label="Bảng B" value={swapGroupB} onChange={(e) => setSwapGroupB(e.target.value)}>
                {groups.map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button variant="outlined" color="warning" onClick={requestSwap}>
              Hoán đổi 2 đội
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Dialog open={Boolean(confirmAction)} onClose={() => setConfirmAction(null)}>
        <DialogTitle>Xác nhận can thiệp chia bảng</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Lịch vòng bảng sẽ được tạo lại sau thao tác này. Bạn có chắc muốn tiếp tục?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Hủy</Button>
          <Button variant="contained" color="warning" onClick={handleConfirm}>
            Tiếp tục
          </Button>
        </DialogActions>
      </Dialog>

      <InterventionFeedbackSnackbar
        open={feedback.open}
        message={feedback.message}
        onClose={() => setFeedback({ open: false, message: "" })}
      />
    </>
  );
}
