import { useMemo, useState } from "react";

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

import { createBooking } from "../../domain/bookingService.js";
import {
  createSocialPlayBookings,
  createSocialPlayEvent,
} from "../../domain/socialPlayService.js";
import { getCourtDisplayName } from "../../models/court.js";
import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";
import { buildEndTimeOptions, buildTimeOptions, todayIsoDate } from "./courtManagement.constants.js";

export default function SocialPlayPanel({ clubId, courts = [], onSaved }) {
  const [title, setTitle] = useState("Social Play");
  const [date, setDate] = useState(todayIsoDate());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("21:00");
  const [courtIds, setCourtIds] = useState([]);
  const [maxPlayers, setMaxPlayers] = useState("16");
  const [feePerPlayer, setFeePerPlayer] = useState("50000");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const { startTimeOptions, endTimeOptions } = useMemo(() => {
    const settings = loadCourtManagementSettings(clubId);
    return {
      startTimeOptions: buildTimeOptions(settings.openHour, settings.closeHour),
      endTimeOptions: buildEndTimeOptions(settings.openHour, settings.closeHour),
    };
  }, [clubId]);

  const toggleCourt = (id) => {
    setCourtIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("Vui lòng nhập tên buổi Social Play.");
      return;
    }

    const event = createSocialPlayEvent({
      title: title.trim(),
      date,
      startTime,
      endTime,
      courtIds,
      maxPlayers: Number(maxPlayers) || 16,
      feePerPlayer: Number(String(feePerPlayer).replace(/[^\d]/g, "")) || 0,
      note: note.trim(),
    });

    const result = createSocialPlayBookings(event, clubId, courts, createBooking);

    if (!result.ok && result.created.length === 0) {
      setError(result.message);
      setMessage(null);
      return;
    }

    setError(null);
    setMessage(result.message);
    onSaved?.();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Social Play</Typography>
          <Typography variant="body2" color="text.secondary">
            Tạo buổi chơi cho khách lẻ và khóa sân trên lịch booking.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          <TextField
            label="Tên buổi"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            fullWidth
          />

          <TextField
            label="Ngày"
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
                  {startTimeOptions.map((time) => (
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
                  {endTimeOptions.map((time) => (
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
              Chọn sân sử dụng
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

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Số người tối đa"
                value={maxPlayers}
                onChange={(event) => setMaxPlayers(event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Phí mỗi người"
                value={feePerPlayer}
                onChange={(event) => setFeePerPlayer(event.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>

          <TextField
            label="Ghi chú"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          <Box>
            <Button variant="contained" onClick={handleSubmit}>
              Tạo Social Play
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
