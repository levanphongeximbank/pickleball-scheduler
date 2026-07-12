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
import GavelIcon from "@mui/icons-material/Gavel";

import {
  FORFEIT_REASON_OPTIONS,
  resolveTechnicalScoreDefaults,
  summarizeStandingsImpact,
  validateForfeitReason,
} from "../../../features/team-tournament/engines/forfeitWorkflowEngine.js";
import { SUB_MATCH_STATUS } from "../../../features/team-tournament/constants.js";

function disciplineName(teamData, disciplineId) {
  return teamData?.disciplines?.find((d) => d.id === disciplineId)?.name || disciplineId;
}

export default function TeamForfeitDialog({
  open,
  onClose,
  teamData,
  matchup,
  teamA,
  teamB,
  subMatch = null,
  subMatches = [],
  forfeitOps = null,
  busy = false,
  onConfirm,
}) {
  const [subMatchId, setSubMatchId] = useState(subMatch?.id || "");
  const [forfeitingTeamId, setForfeitingTeamId] = useState("");
  const [reasonCode, setReasonCode] = useState(FORFEIT_REASON_OPTIONS[0]?.code || "");
  const [reasonText, setReasonText] = useState("");
  const [localError, setLocalError] = useState("");

  const selectableSubMatches = useMemo(() => {
    const list = subMatch ? [subMatch] : subMatches.length ? subMatches : matchup?.subMatches || [];
    return list.filter(
      (item) =>
        item.status !== SUB_MATCH_STATUS.COMPLETED ||
        !item.resultConfirmedAt
    );
  }, [subMatch, subMatches, matchup?.subMatches]);

  const selectedSubMatch =
    selectableSubMatches.find((item) => item.id === subMatchId) || selectableSubMatches[0] || null;

  const defaults = resolveTechnicalScoreDefaults(
    forfeitOps?.technicalScoreDefaults || teamData?.settings
  );

  const handleSubmit = async () => {
    setLocalError("");
    const reasonCheck = validateForfeitReason(reasonText);
    if (!reasonCheck.ok) {
      setLocalError(reasonCheck.error);
      return;
    }
    if (!selectedSubMatch?.id) {
      setLocalError("Chọn trận con.");
      return;
    }
    if (!forfeitingTeamId) {
      setLocalError("Chọn đội thua kỹ thuật.");
      return;
    }

    await onConfirm?.({
      subMatchId: selectedSubMatch.id,
      subMatchVersion: selectedSubMatch.version ?? forfeitOps?.subMatchVersion,
      forfeitingTeamId,
      resultType: reasonCode,
      reasonCode,
      reasonText: reasonCheck.reason,
    });
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <GavelIcon color="warning" />
          <span>Xử thua kỹ thuật</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {forfeitOps?.blockMessage ? (
            <Alert severity="warning">{forfeitOps.blockMessage}</Alert>
          ) : null}

          {!subMatch ? (
            <FormControl fullWidth size="small">
              <InputLabel>Trận con</InputLabel>
              <Select
                label="Trận con"
                value={subMatchId || selectedSubMatch?.id || ""}
                onChange={(event) => setSubMatchId(event.target.value)}
              >
                {selectableSubMatches.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {disciplineName(teamData, item.disciplineId)} ({item.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Typography variant="body2">
              Trận: {disciplineName(teamData, subMatch.disciplineId)}
            </Typography>
          )}

          <FormControl fullWidth size="small">
            <InputLabel>Đội thua kỹ thuật</InputLabel>
            <Select
              label="Đội thua kỹ thuật"
              value={forfeitingTeamId}
              onChange={(event) => setForfeitingTeamId(event.target.value)}
            >
              <MenuItem value={teamA?.id || matchup?.teamAId}>{teamA?.name || "Đội A"}</MenuItem>
              <MenuItem value={teamB?.id || matchup?.teamBId}>{teamB?.name || "Đội B"}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Loại kết quả</InputLabel>
            <Select
              label="Loại kết quả"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            >
              {FORFEIT_REASON_OPTIONS.map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Lý do chi tiết"
            value={reasonText}
            onChange={(event) => setReasonText(event.target.value)}
            multiline
            minRows={2}
            required
            fullWidth
          />

          <Alert severity="info">
            Tỷ số kỹ thuật mặc định: {defaults.winnerPoints}–{defaults.loserPoints}.{" "}
            {summarizeStandingsImpact(defaults)}.
          </Alert>

          {localError ? <Alert severity="error">{localError}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button
          variant="contained"
          color="warning"
          disabled={busy || forfeitOps?.canApplyForfeit === false}
          onClick={handleSubmit}
        >
          Xác nhận forfeit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
