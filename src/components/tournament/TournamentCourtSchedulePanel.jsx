import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { setTournamentCourtScheduleCommand } from "../../features/tournament/services/tournamentCommands.js";
import { getCourtDisplayName } from "../../models/court.js";
import { buildEndTimeOptions, buildTimeOptions, todayIsoDate } from "../../pages/courtManagement/courtManagement.constants.js";
import {
  applyCourtInventoryToDraftCourtIds,
  courtIdIsSelected,
  hydrateCourtScheduleDraft,
  shouldResetCourtScheduleDraftOnTournamentChange,
} from "./tournamentCourtScheduleDraft.js";

const START_TIME_OPTIONS = buildTimeOptions();
const END_TIME_OPTIONS = buildEndTimeOptions();

export default function TournamentCourtSchedulePanel({
  clubId,
  tenantId = null,
  venueId = null,
  tournament,
  courts = [],
  onSaved,
  emptyMessage = "Chưa có sân khả dụng cho đơn vị hiện tại.",
  onDraftChange,
  recordOnly = false,
}) {
  const schedule = tournament?.courtSchedule;
  const initialDraft = hydrateCourtScheduleDraft(schedule, todayIsoDate());
  const [date, setDate] = useState(initialDraft.date);
  const [startTime, setStartTime] = useState(initialDraft.startTime);
  const [endTime, setEndTime] = useState(initialDraft.endTime);
  const [courtIds, setCourtIds] = useState(initialDraft.courtIds);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const tournamentIdRef = useRef(tournament?.id);

  useEffect(() => {
    if (!tournament) {
      return;
    }
    const prevId = tournamentIdRef.current;
    tournamentIdRef.current = tournament.id;
    if (!shouldResetCourtScheduleDraftOnTournamentChange(prevId, tournament.id)) {
      return;
    }
    const next = hydrateCourtScheduleDraft(tournament.courtSchedule, todayIsoDate());
    setDate(next.date);
    setStartTime(next.startTime);
    setEndTime(next.endTime);
    setCourtIds(next.courtIds);
    setMessage(null);
    setError(null);
  }, [tournament]);

  useEffect(() => {
    setCourtIds((current) =>
      applyCourtInventoryToDraftCourtIds(current, courts, schedule?.courtIds)
    );
  }, [courts, schedule?.courtIds]);

  useEffect(() => {
    onDraftChange?.({ date, startTime, endTime, courtIds });
  }, [date, startTime, endTime, courtIds, onDraftChange]);

  if (!tournament) {
    return null;
  }

  const markDraftDirty = () => {
    setError(null);
    setMessage(null);
  };

  const toggleCourt = (id) => {
    if (busy) {
      return;
    }
    markDraftDirty();
    setCourtIds((current) =>
      courtIdIsSelected(current, id)
        ? current.filter((item) => String(item) !== String(id))
        : [...current, id]
    );
  };

  const handleSync = async () => {
    if (busy || !courts.length || !courtIds.length) {
      if (!busy && (!courts.length || !courtIds.length)) {
        setError("Chưa có sân khả dụng cho đơn vị hiện tại.");
        setMessage(null);
      }
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const commandOptions = { courts };
      if (tenantId) {
        commandOptions.tenantId = tenantId;
      }
      if (venueId) {
        commandOptions.venueId = venueId;
      }
      if (tournament?.version != null) {
        commandOptions.expectedVersion = tournament.version;
      }
      const result = await setTournamentCourtScheduleCommand(
        clubId,
        tournament.id,
        {
          date,
          startTime,
          endTime,
          courtIds,
        },
        commandOptions
      );

      if (!result.ok) {
        setError(result.error || result.message);
        setMessage(null);
        return;
      }

      const saved = result.tournament?.courtSchedule;
      if (saved) {
        setDate(saved.date);
        setStartTime(saved.startTime);
        setEndTime(saved.endTime);
        setCourtIds(Array.isArray(saved.courtIds) ? [...saved.courtIds] : courtIds);
      }
      setError(null);
      setMessage(
        recordOnly
          ? "Đã ghi nhận sân & thời gian cho giải"
          : "Đã khóa sân cho giải."
      );
      onSaved?.(result);
    } finally {
      setBusy(false);
    }
  };

  const fieldsDisabled = busy;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">
              {recordOnly ? "Sân & thời gian thi đấu" : "Khóa sân cho giải đấu"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {recordOnly
                ? "Ghi nhận sân và khung giờ sử dụng cho giải. Việc giữ chỗ trên lịch vận hành sân sẽ được hoàn thiện ở module Vận hành sân."
                : `${tournament.name} · Tạo booking loại tournament trên lịch Quản lý sân`}
            </Typography>
            {!recordOnly && schedule?.syncedAt && (
              <Typography variant="caption" color="text.secondary">
                Lần đồng bộ gần nhất: {new Date(schedule.syncedAt).toLocaleString("vi-VN")}
              </Typography>
            )}
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          <TextField
            label="Ngày giải"
            type="date"
            value={date}
            onChange={(event) => {
              markDraftDirty();
              setDate(event.target.value);
            }}
            fullWidth
            disabled={fieldsDisabled}
            InputLabelProps={{ shrink: true }}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth disabled={fieldsDisabled}>
                <InputLabel>Giờ bắt đầu</InputLabel>
                <Select
                  label="Giờ bắt đầu"
                  value={startTime}
                  onChange={(event) => {
                    markDraftDirty();
                    setStartTime(event.target.value);
                  }}
                >
                  {START_TIME_OPTIONS.map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth disabled={fieldsDisabled}>
                <InputLabel>Giờ kết thúc</InputLabel>
                <Select
                  label="Giờ kết thúc"
                  value={endTime}
                  onChange={(event) => {
                    markDraftDirty();
                    setEndTime(event.target.value);
                  }}
                >
                  {END_TIME_OPTIONS.map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Sân sử dụng
            </Typography>
            {courts.length === 0 ? (
              <Alert severity="info">{emptyMessage}</Alert>
            ) : (
              <FormGroup>
                {courts.map((court, index) => (
                  <FormControlLabel
                    key={court.id}
                    control={
                      <Checkbox
                        checked={courtIdIsSelected(courtIds, court.id)}
                        disabled={fieldsDisabled}
                        onChange={() => toggleCourt(court.id)}
                      />
                    }
                    label={getCourtDisplayName(court, index)}
                  />
                ))}
              </FormGroup>
            )}
          </Box>

          <Button
            variant="contained"
            onClick={handleSync}
            disabled={busy || !courts.length || !courtIds.length}
          >
            {busy
              ? recordOnly
                ? "Đang lưu…"
                : "Đang khóa sân…"
              : recordOnly
                ? "Lưu sân & thời gian"
                : "Khóa sân trên lịch booking"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
