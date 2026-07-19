import { useEffect, useState } from "react";

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

import { setTournamentCourtSchedule } from "../../domain/tournamentService.js";
import { getCourtDisplayName } from "../../models/court.js";
import { buildEndTimeOptions, buildTimeOptions, todayIsoDate } from "../../pages/courtManagement/courtManagement.constants.js";

const START_TIME_OPTIONS = buildTimeOptions();
const END_TIME_OPTIONS = buildEndTimeOptions();

export default function TournamentCourtSchedulePanel({
  clubId,
  tournament,
  courts = [],
  onSaved,
}) {
  const schedule = tournament?.courtSchedule;
  const [date, setDate] = useState(schedule?.date || todayIsoDate());
  const [startTime, setStartTime] = useState(schedule?.startTime || "07:00");
  const [endTime, setEndTime] = useState(schedule?.endTime || "12:00");
  const [courtIds, setCourtIds] = useState(schedule?.courtIds || []);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tournament) {
      return;
    }

    setDate(schedule?.date || todayIsoDate());
    setStartTime(schedule?.startTime || "07:00");
    setEndTime(schedule?.endTime || "12:00");
    setCourtIds(schedule?.courtIds || []);
    setMessage(null);
    setError(null);
  }, [tournament?.id, schedule?.syncedAt]);

  if (!tournament) {
    return null;
  }

  const toggleCourt = (id) => {
    setCourtIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleSync = () => {
    const result = setTournamentCourtSchedule(clubId, tournament.id, {
      date,
      startTime,
      endTime,
      courtIds,
    });

    if (!result.ok) {
      setError(result.error || result.message);
      setMessage(null);
      return;
    }

    setError(null);
    setMessage(
      result.message || "Đã khóa sân cho giải."
    );
    onSaved?.(result);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Khóa sân cho giải đấu</Typography>
            <Typography variant="body2" color="text.secondary">
              {tournament.name} · Tạo booking loại <strong>tournament</strong> trên lịch Quản lý sân
            </Typography>
            {schedule?.syncedAt && (
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
            onChange={(event) => setDate(event.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Giờ bắt đầu</InputLabel>
                <Select label="Giờ bắt đầu" value={startTime} onChange={(event) => setStartTime(event.target.value)}>
                  {START_TIME_OPTIONS.map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Giờ kết thúc</InputLabel>
                <Select label="Giờ kết thúc" value={endTime} onChange={(event) => setEndTime(event.target.value)}>
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
            <FormGroup>
              {courts.map((court, index) => (
                <FormControlLabel
                  key={court.id}
                  control={
                    <Checkbox
                      checked={courtIds.includes(court.id)}
                      onChange={() => toggleCourt(court.id)}
                    />
                  }
                  label={getCourtDisplayName(court, index)}
                />
              ))}
            </FormGroup>
          </Box>

          <Button variant="contained" onClick={handleSync}>
            Khóa sân trên lịch booking
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
