import { useMemo, useState } from "react";

import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";

import { getCourtDisplayName } from "../../models/court.js";
import { loadCourtManagementSettings } from "../../domain/courtManagementSettings.js";
import {
  buildHourSlots,
  findBookingAtSlot,
  getCalendarCellStatus,
} from "../../domain/courtBookingEngine.js";
import {
  CALENDAR_CELL_COLORS,
  BOOKING_TYPE_LABELS,
  formatDisplayDate,
  todayIsoDate,
} from "./courtManagement.constants.js";
import BookingForm from "./BookingForm.jsx";
import BookingDetail from "./BookingDetail.jsx";

function shiftDate(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function CourtCalendarDayView({
  clubId,
  courts = [],
  bookings = [],
  revision = 0,
  onRefresh,
}) {
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [formOpen, setFormOpen] = useState(false);
  const [formDefaults, setFormDefaults] = useState({});
  const [detailBooking, setDetailBooking] = useState(null);

  const hourSlots = useMemo(() => {
    const settings = loadCourtManagementSettings(clubId);
    return buildHourSlots(settings.openHour, settings.closeHour, settings.slotMinutes);
  }, [clubId, revision]);
  const dayBookings = useMemo(
    () => bookings.filter((booking) => booking.date === selectedDate),
    [bookings, selectedDate]
  );

  const openCreateForm = (defaults = {}) => {
    setFormDefaults({
      date: selectedDate,
      ...defaults,
    });
    setFormOpen(true);
  };

  const handleCellClick = (court, slotTime, booking) => {
    if (booking) {
      setDetailBooking(booking);
      return;
    }

    if (court.status === "locked" || court.status === "maintenance" || court.active === false) {
      return;
    }

    const endHour = String(Number(slotTime.slice(0, 2)) + 1).padStart(2, "0");
    openCreateForm({
      courtId: court.id,
      startTime: slotTime,
      endTime: `${endHour}:00`,
    });
  };

  const getCellStyle = (booking, court) => {
    const status = getCalendarCellStatus(booking, court);
    const tone = status.tone || status.color || "empty";
    const colors = CALENDAR_CELL_COLORS[tone] || CALENDAR_CELL_COLORS.empty;

    return {
      bgcolor: colors.bg,
      color: colors.color,
      cursor: booking || court.status === "active" ? "pointer" : "default",
      minWidth: 120,
      verticalAlign: "top",
    };
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<ChevronLeftIcon />}
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
          >
            Trước
          </Button>
          <Button
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={() => setSelectedDate(todayIsoDate())}
          >
            Hôm nay
          </Button>
          <Button
            variant="outlined"
            endIcon={<ChevronRightIcon />}
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
          >
            Sau
          </Button>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {formatDisplayDate(selectedDate)}
          </Typography>
        </Stack>

        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreateForm()}>
          Tạo booking
        </Button>
      </Stack>

      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", minWidth: 70 }}>Giờ</TableCell>
              {courts.map((court, index) => (
                <TableCell key={court.id} sx={{ fontWeight: "bold" }}>
                  {getCourtDisplayName(court, index)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {hourSlots.map((slotTime) => (
              <TableRow key={slotTime}>
                <TableCell sx={{ fontWeight: "medium" }}>{slotTime}</TableCell>
                {courts.map((court) => {
                  const booking = findBookingAtSlot(dayBookings, court.id, selectedDate, slotTime);
                  const status = getCalendarCellStatus(booking, court);
                  const label = booking
                    ? booking.customerName || status.label
                    : status.label;

                  return (
                    <TableCell
                      key={`${court.id}-${slotTime}`}
                      sx={getCellStyle(booking, court)}
                      onClick={() => handleCellClick(court, slotTime, booking)}
                    >
                      <Typography variant="body2" fontWeight={booking ? 600 : 400}>
                        {label}
                      </Typography>
                      {booking && (
                        <Typography variant="caption" display="block">
                          {booking.startTime} - {booking.endTime}
                        </Typography>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
        {Object.entries(CALENDAR_CELL_COLORS).map(([key, value]) => (
          <Chip
            key={key}
            size="small"
            label={BOOKING_TYPE_LABELS[key] || key}
            sx={{ bgcolor: value.bg, color: value.color }}
          />
        ))}
      </Stack>

      <BookingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clubId={clubId}
        courts={courts}
        initialValues={formDefaults}
        onSaved={() => onRefresh?.()}
      />

      <BookingDetail
        open={Boolean(detailBooking)}
        booking={detailBooking}
        clubId={clubId}
        courts={courts}
        onClose={() => setDetailBooking(null)}
        onUpdated={() => {
          onRefresh?.();
          setDetailBooking(null);
        }}
      />
    </Box>
  );
}
