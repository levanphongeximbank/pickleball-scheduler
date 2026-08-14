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
import { getSchedulePublishStatus } from "../../../tournament/engines/publishScheduleEngine.js";
import { resolveInternalSchedulePrerequisite } from "../../../features/tournament/internal/internalSchedulePrerequisite.js";
import { formatInternalMatchRefereeLabel } from "../../../features/tournament/internal/internalMatchRefereeAssignment.js";
import {
  INTERNAL_COURT_AVAILABILITY,
  assignCourtsAndTimesToExistingInternalMatches,
  classifyInternalCourtAvailability,
} from "../../../features/tournament/internal/internalScheduleCourts.js";
import {
  INTERNAL_SCHEDULE_ACTIONS,
  lockInternalSchedule,
  publishInternalSchedule,
  resolveInternalScheduleLifecycle,
} from "../../../features/tournament/internal/internalScheduleLifecycle.js";

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function courtLabel(match, courts = []) {
  if (match?.courtName) return match.courtName;
  const court = courts.find((item) => String(item.id) === String(match?.courtId));
  return court?.name || match?.courtId || "—";
}

const EMPTY_MATCHES = [];

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
  const matches = Array.isArray(event?.matches) ? event.matches : EMPTY_MATCHES;
  const [date, setDate] = useState(schedule.date || todayIsoDate());
  const [startTime, setStartTime] = useState(schedule.startTime || "08:00");
  const [minRestMinutes, setMinRestMinutes] = useState(
    Number(publish.minRestMinutes) || 15
  );
  const [message, setMessage] = useState(null);
  const [pendingAction, setPendingAction] = useState("");

  const courtAvailability = useMemo(
    () => classifyInternalCourtAvailability(courts),
    [courts]
  );

  const lifecycle = useMemo(
    () =>
      resolveInternalScheduleLifecycle({
        tournament,
        event,
        matches,
        courtAvailability,
      }),
    [tournament, event, matches, courtAvailability]
  );

  const prerequisite = resolveInternalSchedulePrerequisite({
    hasGroups: lifecycle.drawConfirmed,
    hasDate: Boolean(date),
    hasMatches: matches.length > 0,
  });

  const statusLabel =
    publish.status === "published"
      ? "Published"
      : publish.status === "locked"
        ? "Locked"
        : "Draft";

  const createAction = lifecycle.actions[INTERNAL_SCHEDULE_ACTIONS.CREATE];
  const assignAction = lifecycle.actions[INTERNAL_SCHEDULE_ACTIONS.ASSIGN_COURTS];
  const lockAction = lifecycle.actions[INTERNAL_SCHEDULE_ACTIONS.LOCK];
  const publishAction = lifecycle.actions[INTERNAL_SCHEDULE_ACTIONS.PUBLISH];

  const persistMatches = async (nextTournament, nextMatches) => {
    const withSchedule = {
      ...nextTournament,
      courtSchedule: {
        ...(nextTournament.courtSchedule || schedule),
        date,
        startTime,
        endTime: schedule.endTime || "22:00",
        courtIds: (courts || []).map((court) => court.id),
      },
    };
    return onPersistSettings?.(withSchedule, nextMatches);
  };

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

  const assignOntoExisting = async (currentTournament, currentMatches) => {
    const allocated = assignCourtsAndTimesToExistingInternalMatches({
      matches: currentMatches,
      courts,
      date,
      startTime,
      matchMinutes: 25,
      bufferMinutes: 5,
    });
    if (!allocated.ok) {
      setMessage({ type: "error", text: allocated.error });
      return false;
    }
    const persisted = await persistMatches(currentTournament, allocated.matches);
    if (persisted === false) return false;
    setMessage({
      type: "success",
      text: `Đã xếp sân/giờ cho ${allocated.matchCount} trận (không tạo trận mới).`,
    });
    return true;
  };

  const handleCreate = async () => {
    if (!createAction.enabled) {
      setMessage({ type: "error", text: createAction.reason || prerequisite.message });
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
    const existingMatches = currentEvent?.matches || matches;
    await assignOntoExisting(currentTournament, existingMatches);
    setPendingAction("");
  };

  const handleAssignCourts = async () => {
    if (!assignAction.enabled) {
      setMessage({ type: "error", text: assignAction.reason });
      return;
    }
    setPendingAction("assign");
    let currentTournament = tournament;
    let currentMatches = matches;
    if (!currentMatches.length && onCreateMatches) {
      const created = await onCreateMatches();
      if (created && created.ok === false) {
        setPendingAction("");
        return;
      }
      currentTournament = created?.tournament || tournament;
      currentMatches = currentTournament?.events?.[0]?.matches || matches;
    }
    await assignOntoExisting(currentTournament, currentMatches);
    setPendingAction("");
  };

  const runLifecycle = async (fn, okText, actionKey) => {
    setPendingAction(actionKey);
    const result = fn();
    if (!result.ok) {
      setPendingAction("");
      setMessage({ type: "error", text: result.error });
      return;
    }
    const persisted = await persistMatches(
      result.tournament,
      result.snapshot || matches
    );
    setPendingAction("");
    if (persisted === false) return;
    setMessage({ type: "success", text: okText });
  };

  const courtCaption =
    courtAvailability.state === INTERNAL_COURT_AVAILABILITY.AVAILABLE
      ? (courts || []).map((court) => court.name || court.id).join(", ")
      : courtAvailability.message;

  const nextHint = !lifecycle.schedulePublished
    ? !lifecycle.courtsAssigned
      ? assignAction.reason || "Phân sân và giờ cho tất cả trận trước khi khóa lịch."
      : !lifecycle.scheduleLocked
        ? lockAction.reason || "Khóa lịch trước khi công bố."
        : publishAction.reason || ""
    : "";

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Lịch thi đấu</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`Ngày: ${date || "—"}`} />
        <Chip size="small" label={`Giờ bắt đầu: ${startTime || "—"}`} />
        <Chip size="small" label={`Nghỉ tối thiểu: ${minRestMinutes} phút`} />
        <Chip size="small" label={`Số sân: ${courtAvailability.availableCount}`} />
        <Chip size="small" label={`Số trận: ${matches.length}`} />
        <Chip
          size="small"
          label={`Bốc thăm: ${
            lifecycle.drawPublished
              ? "Đã công bố"
              : lifecycle.drawConfirmed
                ? "Đã chia bảng"
                : "Nháp"
          }`}
          variant="outlined"
        />
        <Chip size="small" label={`Lịch: ${statusLabel}`} color="primary" variant="outlined" />
      </Stack>

      {message ? (
        <Alert severity={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      ) : null}

      {courtAvailability.message ? (
        <Alert severity="warning">{courtAvailability.message}</Alert>
      ) : null}

      {nextHint && !courtAvailability.message ? (
        <Alert severity="info">{nextHint}</Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            type="date"
            label="Ngày thi đấu"
            value={date}
            onChange={(eventChange) => setDate(eventChange.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="time"
            label="Giờ bắt đầu"
            value={startTime}
            onChange={(eventChange) => setStartTime(eventChange.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="number"
            label="Nghỉ tối thiểu (phút)"
            value={minRestMinutes}
            onChange={(eventChange) =>
              setMinRestMinutes(Math.max(0, Number(eventChange.target.value) || 0))
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
          Sân khả dụng: {courtCaption || "—"}
        </Typography>
      </Paper>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          disabled={busy || !createAction.enabled || pendingAction === "create"}
          title={createAction.reason || ""}
          onClick={() => void handleCreate()}
        >
          {pendingAction === "create" ? "Đang tạo lịch..." : "Tạo lịch"}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !assignAction.enabled || pendingAction === "assign"}
          title={assignAction.reason || ""}
          onClick={() => void handleAssignCourts()}
        >
          {pendingAction === "assign" ? "Đang xếp sân..." : "Xếp sân/giờ"}
        </Button>
        <Button
          variant="outlined"
          disabled={busy || !lockAction.enabled || pendingAction === "lock"}
          title={lockAction.reason || ""}
          onClick={() =>
            void runLifecycle(
              () => lockInternalSchedule(tournament, matches, { actor, clubId }),
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
          disabled={busy || !publishAction.enabled || pendingAction === "publish"}
          title={publishAction.reason || ""}
          onClick={() =>
            void runLifecycle(
              () => publishInternalSchedule(tournament, matches, { actor, clubId }),
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
                  <TableCell>{courtLabel(match, courts)}</TableCell>
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
