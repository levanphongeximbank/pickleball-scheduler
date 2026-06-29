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

import { createRecurringSeriesBookings } from "../../domain/bookingService.js";
import { WEEKDAY_LABELS } from "../../domain/recurringBookingService.js";
import { getCourtDisplayName } from "../../models/court.js";
import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";
import { buildEndTimeOptions, buildTimeOptions, todayIsoDate } from "./courtManagement.constants.js";

export default function RecurringBookingPanel({ clubId, courts = [], onSaved }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [courtId, setCourtId] = useState(courts[0]?.id || "");
  const [weekday, setWeekday] = useState(1);
  const [startDate, setStartDate] = useState(todayIsoDate());
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [totalAmount, setTotalAmount] = useState("");
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
    if (!customerName.trim()) {
      setError("Vui lòng nhập tên khách.");
      return;
    }

    if (!courtId) {
      setError("Vui lòng chọn sân.");
      return;
    }

    if (!endDate) {
      setError("Vui lòng chọn ngày kết thúc.");
      return;
    }

    const result = createRecurringSeriesBookings(
      {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        courtId,
        weekday,
        startDate,
        endDate,
        startTime,
        endTime,
        totalAmount: Number(String(totalAmount).replace(/[^\d]/g, "")) || 0,
        note: note.trim(),
      },
      clubId
    );

    if (!result.ok) {
      setError(result.message);
      setMessage(null);
      return;
    }

    setError(null);
    setMessage(
      `${result.message}${result.skipped?.length ? ` · Bỏ qua ${result.skipped.length} ngày trùng lịch.` : ""}`
    );
    onSaved?.();
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Booking cố định / lặp tuần</Typography>
          <Typography variant="body2" color="text.secondary">
            Tạo chuỗi booking hằng tuần theo thứ trong tuần. Mỗi buổi hiện trên lịch sân như booking thường.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          <TextField
            label="Tên khách"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Số điện thoại"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Sân</InputLabel>
            <Select label="Sân" value={courtId} onChange={(event) => setCourtId(event.target.value)}>
              {courts.map((court, index) => (
                <MenuItem key={court.id} value={court.id}>
                  {getCourtDisplayName(court, index)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Lặp vào thứ</InputLabel>
            <Select label="Lặp vào thứ" value={weekday} onChange={(event) => setWeekday(event.target.value)}>
              {WEEKDAY_LABELS.map((label, index) => (
                <MenuItem key={label} value={index}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Từ ngày"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Đến ngày"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

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

          <TextField
            label="Tổng tiền mỗi buổi"
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            fullWidth
          />

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
              Tạo chuỗi booking
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
