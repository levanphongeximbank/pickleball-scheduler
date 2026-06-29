import { useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { createMaintenanceBooking } from "../../domain/bookingService.js";
import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";
import { getCourtDisplayName } from "../../models/court.js";
import {
  buildEndTimeOptions,
  buildTimeOptions,
  todayIsoDate,
} from "./courtManagement.constants.js";

export default function MaintenanceBookingPanel({ clubId, courts = [], onSaved }) {
  const [date, setDate] = useState(todayIsoDate());
  const [courtId, setCourtId] = useState(courts[0]?.id || "");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
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

  const handleSubmit = () => {
    const result = createMaintenanceBooking(
      {
        courtId,
        date,
        startTime,
        endTime,
        note: note.trim() || "Bảo trì sân",
      },
      clubId
    );

    if (!result.ok) {
      setError(result.message);
      setMessage(null);
      return;
    }

    setError(null);
    setMessage("Đã khóa sân bảo trì trên lịch booking.");
    onSaved?.();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Khóa sân bảo trì</Typography>
          <Typography variant="body2" color="text.secondary">
            Tạo booking loại bảo trì để chặn khách đặt trùng giờ.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          <FormControl fullWidth>
            <InputLabel>Sân</InputLabel>
            <Select label="Sân" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
              {courts.map((court, index) => (
                <MenuItem key={court.id} value={court.id}>
                  {getCourtDisplayName(court, index)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Ngày"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Từ giờ</InputLabel>
                <Select label="Từ giờ" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
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
                <InputLabel>Đến giờ</InputLabel>
                <Select label="Đến giờ" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                  {endTimeOptions.map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TextField
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            placeholder="Ví dụ: Sửa mặt sân, thay lưới..."
          />

          <Box>
            <Button variant="contained" color="warning" onClick={handleSubmit}>
              Khóa bảo trì
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
