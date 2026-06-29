import { useMemo, useState } from "react";

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";

import {
  getBookingsByDate,
  getMonthCalendarDates,
  shiftIsoMonth,
} from "../../domain/courtBookingEngine.js";
import { isActiveBookingStatus } from "../../models/booking.js";
import { formatDisplayDate, todayIsoDate } from "./courtManagement.constants.js";
import BookingDetail from "./BookingDetail.jsx";

const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const MONTH_LABELS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

export default function CourtCalendarMonthView({
  clubId,
  courts = [],
  bookings = [],
  onRefresh,
}) {
  const [anchorDate, setAnchorDate] = useState(todayIsoDate());
  const [selectedDate, setSelectedDate] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);

  const monthCells = useMemo(() => getMonthCalendarDates(anchorDate), [anchorDate]);

  const [year, month] = anchorDate.split("-").map(Number);
  const monthLabel = `${MONTH_LABELS[month - 1]} ${year}`;

  const bookingsByDate = useMemo(() => {
    const map = new Map();

    monthCells.forEach(({ date }) => {
      const dayBookings = getBookingsByDate(bookings, date).filter((booking) =>
        isActiveBookingStatus(booking.bookingStatus)
      );
      map.set(date, dayBookings);
    });

    return map;
  }, [bookings, monthCells]);

  const selectedDayBookings = selectedDate ? bookingsByDate.get(selectedDate) || [] : [];

  const weeks = useMemo(() => {
    const rows = [];

    for (let index = 0; index < monthCells.length; index += 7) {
      rows.push(monthCells.slice(index, index + 7));
    }

    return rows;
  }, [monthCells]);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<ChevronLeftIcon />}
            onClick={() => setAnchorDate(shiftIsoMonth(anchorDate, -1))}
          >
            Tháng trước
          </Button>
          <Button
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={() => setAnchorDate(todayIsoDate())}
          >
            Tháng này
          </Button>
          <Button
            variant="outlined"
            endIcon={<ChevronRightIcon />}
            onClick={() => setAnchorDate(shiftIsoMonth(anchorDate, 1))}
          >
            Tháng sau
          </Button>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {monthLabel}
          </Typography>
        </Stack>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {WEEKDAY_SHORT.map((label) => (
                <TableCell key={label} align="center" sx={{ fontWeight: "bold" }}>
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {weeks.map((week, weekIndex) => (
              <TableRow key={weekIndex}>
                {week.map(({ date, inMonth }) => {
                  const dayBookings = bookingsByDate.get(date) || [];
                  const dayNumber = Number(date.split("-")[2]);
                  const isToday = date === todayIsoDate();

                  return (
                    <TableCell
                      key={date}
                      onClick={() => dayBookings.length > 0 && setSelectedDate(date)}
                      sx={{
                        verticalAlign: "top",
                        height: 88,
                        cursor: dayBookings.length > 0 ? "pointer" : "default",
                        bgcolor: isToday ? "#fff8e1" : inMonth ? "inherit" : "#fafafa",
                        opacity: inMonth ? 1 : 0.55,
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={isToday ? "bold" : "medium"}
                        color={inMonth ? "text.primary" : "text.secondary"}
                      >
                        {dayNumber}
                      </Typography>
                      {dayBookings.length > 0 && (
                        <Chip
                          size="small"
                          color="primary"
                          label={`${dayBookings.length} lịch`}
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={Boolean(selectedDate)}
        onClose={() => setSelectedDate(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Lịch ngày {selectedDate ? formatDisplayDate(selectedDate) : ""}
        </DialogTitle>
        <DialogContent>
          {selectedDayBookings.length === 0 ? (
            <Typography color="text.secondary">Không có booking.</Typography>
          ) : (
            <Stack spacing={1} sx={{ pt: 1 }}>
              {selectedDayBookings.map((booking) => (
                <Chip
                  key={booking.id}
                  label={`${booking.startTime}–${booking.endTime} · ${booking.courtName} · ${booking.customerName}`}
                  onClick={() => {
                    setSelectedDate(null);
                    setDetailBooking(booking);
                  }}
                  sx={{ justifyContent: "flex-start", height: "auto", py: 1 }}
                />
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

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
