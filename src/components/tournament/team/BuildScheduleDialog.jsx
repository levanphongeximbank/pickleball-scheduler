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
  defaultCourtCountForPool,
  describeSchedulePreview,
  recommendGroupSizes,
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

  const schedulePreview = useMemo(
    () => describeSchedulePreview(teamData, previewOptions),
    [teamData, previewOptions]
  );

  const teamCount = teamData?.teams?.length || 0;
  const needsGroups = teamCount >= 6 && recommendGroupSizes(teamCount);

  function handleConfirm() {
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

          {needsGroups && !(teamData?.groups || []).length ? (
            <Alert severity="info">
              Giải {teamCount} đội sẽ tự chia 2 bảng khi tạo lịch nếu chưa chia bảng.
            </Alert>
          ) : null}

          <Alert severity="info">{schedulePreview}</Alert>

          <TextField
            label="Hạn nộp đội hình (vòng 1)"
            type="datetime-local"
            value={lineupLockAt}
            onChange={(event) => setLineupLockAt(event.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Mặc định 15 phút trước giờ thi đấu vòng 1 (MLP)."
          />
          <TextField
            label="Giờ thi đấu vòng 1"
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Số sân song song"
            value={courtCount}
            onChange={(event) => setCourtCount(Number(event.target.value))}
            fullWidth
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
          />
          <TextField
            label="Tiền tố tên sân (tuỳ chọn)"
            value={courtLabel}
            onChange={(event) => setCourtLabel(event.target.value)}
            fullWidth
            placeholder="VD: Sân chính"
            helperText="Mỗi trận sẽ gắn Sân 1 / Sân 2 trong vòng."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        {onPreview && (teamData?.matchups?.length || 0) > 0 ? (
          <Button onClick={onPreview}>Xem sơ đồ trước</Button>
        ) : null}
        <Button variant="contained" onClick={handleConfirm}>
          Tạo lịch
        </Button>
      </DialogActions>
    </Dialog>
  );
}
