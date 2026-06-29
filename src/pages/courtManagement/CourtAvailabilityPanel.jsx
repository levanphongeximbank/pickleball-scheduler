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

import { findAvailableSlots } from "../../domain/courtBookingEngine.js";
import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";
import { formatTimeRange, todayIsoDate } from "./courtManagement.constants.js";
import BookingForm from "./BookingForm.jsx";

const DURATION_OPTIONS = [60, 90, 120, 180];

export default function CourtAvailabilityPanel({ clubId, courts = [], bookings = [], onSaved }) {
  const [date, setDate] = useState(todayIsoDate());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [formOpen, setFormOpen] = useState(false);
  const [formDefaults, setFormDefaults] = useState({});

  const slots = useMemo(() => {
    const settings = loadCourtManagementSettings(clubId);

    return findAvailableSlots({
      bookings,
      courts,
      date,
      durationMinutes,
      openHour: settings.openHour,
      closeHour: settings.closeHour,
      slotMinutes: settings.slotMinutes,
    });
  }, [bookings, courts, date, durationMinutes, clubId]);

  const openBookingForm = (slot) => {
    setFormDefaults({
      courtId: slot.courtId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    setFormOpen(true);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Tìm sân trống</Typography>
            <Typography variant="body2" color="text.secondary">
              Gợi ý khung giờ còn trống theo ngày và thời lượng chơi.
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Ngày"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth>
                <InputLabel>Thời lượng</InputLabel>
                <Select
                  label="Thời lượng"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                >
                  {DURATION_OPTIONS.map((minutes) => (
                    <MenuItem key={minutes} value={minutes}>
                      {minutes / 60} giờ
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {slots.length === 0 ? (
            <Alert severity="info">Không tìm thấy sân trống phù hợp.</Alert>
          ) : (
            <Stack spacing={1}>
              {slots.slice(0, 12).map((slot) => (
                <Stack
                  key={`${slot.courtId}-${slot.startTime}`}
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", sm: "center" }}
                  sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}
                >
                  <Box>
                    <Typography fontWeight="bold">{slot.courtName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatTimeRange(slot.startTime, slot.endTime)}
                    </Typography>
                  </Box>
                  <Button variant="contained" size="small" onClick={() => openBookingForm(slot)}>
                    Đặt ngay
                  </Button>
                </Stack>
              ))}
              {slots.length > 12 && (
                <Typography variant="caption" color="text.secondary">
                  Hiển thị 12/{slots.length} khung giờ trống đầu tiên.
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>

      <BookingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clubId={clubId}
        courts={courts}
        initialValues={formDefaults}
        onSaved={() => {
          setFormOpen(false);
          onSaved?.();
        }}
      />
    </Card>
  );
}
