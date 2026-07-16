import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

import {
  assertGroupsReadyForSchedule,
  defaultCourtCountForPool,
  describeSchedulePreview,
  GROUPS_REQUIRED_SCHEDULE_DIALOG_MESSAGE,
} from "../../../features/team-tournament/engines/teamRoundRobinScheduleEngine.js";

function toLocalInputValue(isoString) {
  if (!isoString) {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    return date.toISOString().slice(0, 16);
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInputValue(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveDefaultCourtCount(teamData) {
  const teams = teamData?.teams || [];
  const groups = (teamData?.groups || []).filter((group) => group.teamIds?.length >= 2);

  if (groups.length > 0) {
    const maxPool = Math.max(...groups.map((group) => group.teamIds.length));
    return defaultCourtCountForPool(maxPool);
  }

  if (teams.length >= 2) {
    return defaultCourtCountForPool(teams.length);
  }

  return 2;
}

export default function BuildScheduleDialog({
  open,
  onClose,
  onConfirm,
  teamData,
  hasExistingResults = false,
  onPreview,
  onGoToGroups,
}) {
  const defaultLock = toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  const defaultSchedule = toLocalInputValue(new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString());

  const [lineupLockAt, setLineupLockAt] = useState(defaultLock);
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule);
  const [courtLabel, setCourtLabel] = useState("");
  const [courtCount, setCourtCount] = useState(2);
  const [roundIntervalMinutes, setRoundIntervalMinutes] = useState(90);

  useEffect(() => {
    if (open) {
      setCourtCount(resolveDefaultCourtCount(teamData));
    }
  }, [open, teamData]);

  const previewOptions = useMemo(
    () => ({
      courtCount,
      roundIntervalMinutes,
    }),
    [courtCount, roundIntervalMinutes]
  );

  const groupsGate = useMemo(() => assertGroupsReadyForSchedule(teamData), [teamData]);
  const groupsBlocked = groupsGate.ok === false;

  const schedulePreview = useMemo(
    () => (groupsBlocked ? "" : describeSchedulePreview(teamData, previewOptions)),
    [teamData, previewOptions, groupsBlocked]
  );

  function handleConfirm() {
    if (groupsBlocked) {
      return;
    }
    const scheduleIso = fromLocalInputValue(scheduledAt);
    const lockIso =
      fromLocalInputValue(lineupLockAt) ||
      (scheduleIso
        ? new Date(new Date(scheduleIso).getTime() - 15 * 60 * 1000).toISOString()
        : null);

    onConfirm({
      lineupLockAt: lockIso,
      scheduledAt: scheduleIso,
      courtLabel: courtLabel.trim(),
      courtCount,
      roundIntervalMinutes,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Tạo lịch vòng tròn</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {hasExistingResults ? (
            <Alert severity="warning">
              Đã có kết quả trận. Tạo lại lịch sẽ xóa toàn bộ lượt đối đầu hiện tại.
            </Alert>
          ) : null}

          {groupsBlocked ? (
            <Alert severity="warning">
              {GROUPS_REQUIRED_SCHEDULE_DIALOG_MESSAGE}
            </Alert>
          ) : null}

          {!groupsBlocked && schedulePreview ? (
            <Alert severity="info">{schedulePreview}</Alert>
          ) : null}

          <TextField
            label="Hạn nộp đội hình (vòng 1)"
            type="datetime-local"
            value={lineupLockAt}
            onChange={(event) => setLineupLockAt(event.target.value)}
            fullWidth
            disabled={groupsBlocked}
            InputLabelProps={{ shrink: true }}
            helperText="Mặc định 15 phút trước giờ thi đấu vòng 1 (MLP)."
          />
          <TextField
            label="Giờ thi đấu vòng 1"
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            fullWidth
            disabled={groupsBlocked}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Số sân song song"
            value={courtCount}
            onChange={(event) => setCourtCount(Number(event.target.value))}
            fullWidth
            disabled={groupsBlocked}
          >
            <MenuItem value={1}>1 sân</MenuItem>
            <MenuItem value={2}>2 sân</MenuItem>
          </TextField>
          <TextField
            label="Khoảng cách giữa các vòng (phút)"
            type="number"
            value={roundIntervalMinutes}
            inputProps={{ min: 15, step: 15 }}
            onChange={(event) => setRoundIntervalMinutes(Number(event.target.value) || 90)}
            fullWidth
            disabled={groupsBlocked}
          />
          <TextField
            label="Tiền tố tên sân (tuỳ chọn)"
            value={courtLabel}
            onChange={(event) => setCourtLabel(event.target.value)}
            fullWidth
            disabled={groupsBlocked}
            placeholder="VD: Sân chính"
            helperText="Mỗi trận sẽ gắn Sân 1 / Sân 2 trong vòng."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        {groupsBlocked && onGoToGroups ? (
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              onClose?.();
              onGoToGroups();
            }}
          >
            Về bước Chia bảng
          </Button>
        ) : null}
        {onPreview && (teamData?.matchups?.length || 0) > 0 && !groupsBlocked ? (
          <Button onClick={onPreview}>Xem sơ đồ trước</Button>
        ) : null}
        <Button variant="contained" onClick={handleConfirm} disabled={groupsBlocked}>
          Tạo lịch
        </Button>
      </DialogActions>
    </Dialog>
  );
}
