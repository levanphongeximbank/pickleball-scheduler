import { useMemo, useState } from "react";

import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ScheduleIcon from "@mui/icons-material/Schedule";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import SchedulePublishControls from "./SchedulePublishControls.jsx";
import {
  getSchedulePublishStatus,
  rescheduleMatch,
  canEditSchedule,
} from "../../tournament/engines/publishScheduleEngine.js";
import {
  warnIfRestViolated,
  validateScheduleConflicts,
} from "../../features/individual-tournament/engines/restTimeEngine.js";

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function courtLabel(courtId, courts = []) {
  const court = courts.find((c) => String(c.id) === String(courtId));
  return court?.name || courtId || "—";
}

export default function ScheduleBuilderPanel({
  tournament,
  matches = [],
  courts = [],
  minRestMinutes = 15,
  schedulePublish: publishProp,
  hasReopenPermission = false,
  onGenerate,
  onRegenerate,
  onLock,
  onPublish,
  onReopen,
  onForceRepublish,
  onMatchesChange,
  entryLabels = {},
  compact = false,
}) {
  const schedulePublish = publishProp || getSchedulePublishStatus(tournament);
  const [opsMatchId, setOpsMatchId] = useState("");
  const [opsCourtId, setOpsCourtId] = useState("");
  const [opsStart, setOpsStart] = useState("");
  const [opsMessage, setOpsMessage] = useState(null);

  const conflictReport = useMemo(
    () => validateScheduleConflicts(matches, { minRestMinutes }),
    [matches, minRestMinutes]
  );

  const editCheck = canEditSchedule(tournament);

  const handleReschedule = () => {
    if (!opsMatchId) {
      setOpsMessage({ type: "error", text: "Chọn trận cần đổi." });
      return;
    }
    if (!editCheck.ok) {
      setOpsMessage({ type: "error", text: editCheck.error });
      return;
    }

    const match = matches.find((m) => String(m.id) === String(opsMatchId));
    const duration =
      match?.scheduledStart && match?.scheduledEnd
        ? new Date(match.scheduledEnd).getTime() - new Date(match.scheduledStart).getTime()
        : 25 * 60 * 1000;

    const scheduledStart = opsStart
      ? new Date(opsStart).toISOString()
      : match?.scheduledStart;
    const scheduledEnd = scheduledStart
      ? new Date(new Date(scheduledStart).getTime() + duration).toISOString()
      : match?.scheduledEnd;

    const patched = rescheduleMatch(tournament, matches, opsMatchId, {
      courtId: opsCourtId || match?.courtId,
      scheduledStart,
      scheduledEnd,
    });

    if (!patched.ok) {
      setOpsMessage({ type: "error", text: patched.error });
      return;
    }

    const restWarn = warnIfRestViolated(patched.matches, minRestMinutes);
    onMatchesChange?.(patched.matches, restWarn.warnings);
    setOpsMessage({
      type: restWarn.warnings.length ? "warning" : "success",
      text: restWarn.warnings.length
        ? `Đã lưu; cảnh báo nghỉ: ${restWarn.warnings[0]}`
        : "Đã cập nhật sân/giờ trận.",
    });
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          icon={<ScheduleIcon />}
          label={`Nghỉ tối thiểu: ${minRestMinutes} phút`}
          color="primary"
          variant="outlined"
        />
        <Chip size="small" label={`Trận: ${matches.length}`} variant="outlined" />
        {conflictReport.warnings.length > 0 && (
          <Chip
            size="small"
            icon={<WarningAmberIcon />}
            label={`${conflictReport.warnings.length} cảnh báo nghỉ`}
            color="warning"
          />
        )}
        {conflictReport.errors.length > 0 && (
          <Chip
            size="small"
            label={`${conflictReport.errors.length} xung đột cứng`}
            color="error"
          />
        )}
      </Stack>

      {(onGenerate || onRegenerate) && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {onGenerate && (
            <Button
              variant="contained"
              startIcon={<ScheduleIcon />}
              onClick={onGenerate}
              disabled={!editCheck.ok}
              title={editCheck.ok ? "" : editCheck.error}
            >
              Tạo lịch đấu
            </Button>
          )}
          {onRegenerate && (
            <Button
              variant="outlined"
              onClick={onRegenerate}
              disabled={!editCheck.ok}
              title={editCheck.ok ? "" : editCheck.error}
            >
              Tạo lại lịch
            </Button>
          )}
        </Stack>
      )}

      <SchedulePublishControls
        tournament={tournament}
        matches={matches}
        schedulePublish={schedulePublish}
        hasReopenPermission={hasReopenPermission}
        onLock={onLock}
        onPublish={onPublish}
        onReopen={onReopen}
        onForceRepublish={onForceRepublish}
        compact={compact}
      />

      {conflictReport.errors.length > 0 && (
        <Alert severity="error">
          {conflictReport.errors.slice(0, 3).join(" · ")}
        </Alert>
      )}
      {conflictReport.warnings.length > 0 && (
        <Alert severity="warning">
          {conflictReport.warnings.slice(0, 3).join(" · ")}
        </Alert>
      )}

      {matches.length === 0 ? (
        <Alert severity="info">Chưa có lịch. Công bố bốc thăm rồi tạo lịch.</Alert>
      ) : (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Trận</TableCell>
                <TableCell>Đối đầu</TableCell>
                <TableCell>Giờ</TableCell>
                <TableCell>Sân</TableCell>
                <TableCell>Phiên</TableCell>
                <TableCell>Slot</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matches.slice(0, 80).map((match) => (
                <TableRow key={match.id}>
                  <TableCell>{match.id}</TableCell>
                  <TableCell>
                    {entryLabels[match.entryAId] || match.entryAId || "—"} vs{" "}
                    {entryLabels[match.entryBId] || match.entryBId || "—"}
                  </TableCell>
                  <TableCell>{formatTime(match.scheduledStart)}</TableCell>
                  <TableCell>{courtLabel(match.courtId, courts)}</TableCell>
                  <TableCell>{match.session || "—"}</TableCell>
                  <TableCell>{match.slot ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {editCheck.ok && onMatchesChange && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
            Đổi sân / giờ (BTC)
          </Typography>
          {opsMessage && (
            <Alert
              severity={opsMessage.type}
              sx={{ mb: 1 }}
              onClose={() => setOpsMessage(null)}
            >
              {opsMessage.text}
            </Alert>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
            <TextField
              select
              size="small"
              label="Trận"
              value={opsMatchId}
              onChange={(e) => setOpsMatchId(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              {matches.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Sân"
              value={opsCourtId}
              onChange={(e) => setOpsCourtId(e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">— giữ —</MenuItem>
              {courts
                .filter((c) => !c.locked)
                .map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name || c.id}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              size="small"
              label="Bắt đầu"
              type="datetime-local"
              value={opsStart}
              onChange={(e) => setOpsStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="outlined" onClick={handleReschedule}>
              Áp dụng
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Vi phạm nghỉ tối thiểu vẫn cho lưu nhưng hiện cảnh báo cho BTC.
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}
