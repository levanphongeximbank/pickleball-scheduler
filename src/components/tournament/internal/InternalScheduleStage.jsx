import { useMemo, useState } from "react";

import {
  Alert,
  Button,
  Chip,
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

import { todayIsoDate } from "../../../pages/courtManagement/courtManagement.constants.js";
import {
  canEditSchedule,
  getSchedulePublishStatus,
  lockSchedule,
  publishSchedule,
  recordScheduleCreated,
} from "../../../tournament/engines/publishScheduleEngine.js";
import { generateSchedule } from "../../../features/tournament-engine/engines/scheduleEngine.js";
import { listGroupStageMatches } from "../../../features/tournament/internal/internalTournamentOneGroupCompletion.js";
import { resolveInternalSchedulePrerequisite } from "../../../features/tournament/internal/internalSchedulePrerequisite.js";
import { formatInternalMatchRefereeLabel } from "../../../features/tournament/internal/internalMatchRefereeAssignment.js";

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function courtLabel(courtId, courts = []) {
  const court = courts.find((item) => String(item.id) === String(courtId));
  return court?.name || courtId || "—";
}

export default function InternalScheduleStage({
  tournament,
  event,
  courts = [],
  entryLabels = {},
  busy = false,
  onSaveCourtSchedule,
  onCreateMatches,
  onPersistSettings,
  actor = null,
  clubId = "",
}) {
  const schedule = tournament?.courtSchedule || {};
  const publish = getSchedulePublishStatus(tournament);
  const matches = listGroupStageMatches(event);
  const [date, setDate] = useState(schedule.date || todayIsoDate());
  const [startTime, setStartTime] = useState(schedule.startTime || "08:00");
  const [minRestMinutes, setMinRestMinutes] = useState(
    Number(publish.minRestMinutes) || 15
  );
  const [message, setMessage] = useState(null);
  const [pendingAction, setPendingAction] = useState("");

  const prerequisite = resolveInternalSchedulePrerequisite({
    hasGroups: (event?.groups || []).length > 0,
    hasDate: Boolean(date),
    hasMatches: matches.length > 0,
  });

  const statusLabel =
    publish.status === "published"
      ? "Published"
      : publish.status === "locked"
        ? "Locked"
        : "Draft";

  const handleSaveMeta = async () => {
    setPendingAction("meta");
    const result = await onSaveCourtSchedule?.({
      date,
      startTime,
      endTime: schedule.endTime || "22:00",
      courtIds: (courts || []).map((court) => court.id),
    });
    setPendingAction("");
    if (result && result.ok === false) {
      setMessage({ type: "error", text: result.error || "Không lưu được ngày thi đấu." });
      return;
    }
    setMessage({ type: "success", text: "Đã lưu ngày và giờ thi đấu." });
  };

  const handleCreate = async () => {
    if (!prerequisite.ok) {
      setMessage({ type: "error", text: prerequisite.message });
      return;
    }
    setPendingAction("create");
    const created = onCreateMatches ? await onCreateMatches() : { ok: true };
    if (created && created.ok === false) {
      setPendingAction("");
      return;
    }

    const currentTournament = created?.tournament || tournament;
    const currentEvent = currentTournament?.events?.[0] || event;
    const existingMatches =
      currentTournament?.settings?.engineV4?.matches ||
      currentEvent?.matches ||
      matches;
    const editCheck = canEditSchedule(currentTournament);
    if (!editCheck.ok) {
      setPendingAction("");
      setMessage({ type: "error", text: editCheck.error });
      return;
    }

    const allocated = generateSchedule(
      {
        tournamentId: currentTournament.id,
        eventId: currentEvent?.id || `event-${currentTournament.id}`,
        matches: existingMatches,
        groups: currentEvent?.groups || [],
        courts: (courts || []).map((court, index) => ({
          id: String(court.id),
          name: court.name || `Sân ${index + 1}`,
          locked: Boolean(court.locked),
          priority: court.priority ?? courts.length - index,
        })),
        scheduleConfig: {
          startTime,
          endTime: currentTournament.courtSchedule?.endTime || "22:00",
          date,
          averageMatchMinutes: 25,
          bufferMinutes: 5,
          minRestMinutes,
        },
      },
      { regenerate: existingMatches.length > 0, strictRest: true }
    );

    if (!allocated.ok) {
      setPendingAction("");
      setMessage({
        type: "error",
        text: (allocated.errors || ["Không tạo được lịch."]).join(" "),
      });
      return;
    }

    const recorded = recordScheduleCreated(currentTournament, allocated.data.matches, {
      actor,
      clubId,
      minRestMinutes,
    });
    const persisted = await onPersistSettings?.(
      recorded.tournament,
      allocated.data.matches
    );
    setPendingAction("");
    if (persisted === false) return;
    setMessage({
      type: "success",
      text: `Đã tạo lịch ${allocated.data.matches.length} trận.`,
    });
  };

  const runLifecycle = async (fn, okText, actionKey) => {
    setPendingAction(actionKey);
    const result = fn();
    if (!result.ok) {
      setPendingAction("");
      setMessage({ type: "error", text: result.error });
      return;
    }
    const persisted = await onPersistSettings?.(
      result.tournament,
      result.snapshot || matches
    );
    setPendingAction("");
    if (persisted === false) return;
    setMessage({ type: "success", text: okText });
  };

  const courtNames = useMemo(
    () => (courts || []).map((court) => court.name || court.id).join(", "),
    [courts]
  );

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Lịch thi đấu</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`Ngày: ${date || "—"}`} />
        <Chip size="small" label={`Giờ bắt đầu: ${startTime || "—"}`} />
        <Chip size="small" label={`Nghỉ tối thiểu: ${minRestMinutes} phút`} />
        <Chip size="small" label={`Số sân: ${(courts || []).length}`} />
        <Chip size="small" label={`Số trận: ${matches.length}`} />
        <Chip size="small" label={statusLabel} color="primary" variant="outlined" />
      </Stack>

      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      {prerequisite.message ? (
        <Alert severity="info">{prerequisite.message}</Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            type="date"
            label="Ngày thi đấu"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="time"
            label="Giờ bắt đầu"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="number"
            label="Nghỉ tối thiểu (phút)"
            value={minRestMinutes}
            onChange={(event) =>
              setMinRestMinutes(Math.max(0, Number(event.target.value) || 0))
            }
            inputProps={{ min: 0 }}
            sx={{ width: 180 }}
          />
          <Button
            variant="outlined"
            disabled={busy || pendingAction === "meta"}
            onClick={() => void handleSaveMeta()}
          >
            Lưu ngày/giờ
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Sân khả dụng: {courtNames || "Chưa có sân"}
        </Typography>
      </Paper>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          disabled={busy || !prerequisite.ok || pendingAction === "create"}
          onClick={() => void handleCreate()}
        >
          {pendingAction === "create" ? "Đang tạo lịch..." : "Tạo lịch"}
        </Button>
        <Button
          variant="outlined"
          disabled={busy || matches.length === 0 || pendingAction === "lock"}
          onClick={() =>
            void runLifecycle(
              () => lockSchedule(tournament, matches, { actor, clubId }),
              "Đã khóa lịch.",
              "lock"
            )
          }
        >
          Khóa lịch
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={busy || matches.length === 0 || pendingAction === "publish"}
          onClick={() =>
            void runLifecycle(
              () => publishSchedule(tournament, matches, { actor, clubId }),
              "Đã công bố lịch.",
              "publish"
            )
          }
        >
          Công bố lịch
        </Button>
      </Stack>

      {matches.length > 0 ? (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Trận</TableCell>
                <TableCell>Đội/VĐV A</TableCell>
                <TableCell>Đội/VĐV B</TableCell>
                <TableCell>Sân</TableCell>
                <TableCell>Giờ</TableCell>
                <TableCell>Trọng tài</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matches.map((match) => (
                <TableRow key={match.id}>
                  <TableCell>{match.id}</TableCell>
                  <TableCell>{entryLabels[match.entryAId] || match.entryAId || "—"}</TableCell>
                  <TableCell>{entryLabels[match.entryBId] || match.entryBId || "—"}</TableCell>
                  <TableCell>{courtLabel(match.courtId, courts)}</TableCell>
                  <TableCell>{formatTime(match.scheduledStart)}</TableCell>
                  <TableCell>{formatInternalMatchRefereeLabel(match)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ) : null}
    </Stack>
  );
}
