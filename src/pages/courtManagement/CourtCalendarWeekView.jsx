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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";

import { getCourtDisplayName } from "../../models/court.js";
import { getBookingsByDate, getWeekDates } from "../../domain/courtBookingEngine.js";
import { isActiveBookingStatus } from "../../models/booking.js";
import {
  formatDisplayDate,
  todayIsoDate,
} from "./courtManagement.constants.js";
import BookingDetail from "./BookingDetail.jsx";

const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function shiftWeek(isoDate, weeks) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const cursor = new Date(year, month - 1, day);
  cursor.setDate(cursor.getDate() + weeks * 7);
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, "0");
  const d = String(cursor.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CourtCalendarWeekView({
  clubId,
  courts = [],
  bookings = [],
  onRefresh,
}) {
  const [anchorDate, setAnchorDate] = useState(todayIsoDate());
  const [detailBooking, setDetailBooking] = useState(null);

  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate]);

  const weekLabel = `${formatDisplayDate(weekDates[0])} – ${formatDisplayDate(weekDates[6])}`;

  const cellBookings = useMemo(() => {
    const map = new Map();

    courts.forEach((court) => {
      weekDates.forEach((date) => {
        const key = `${court.id}-${date}`;
        const dayBookings = getBookingsByDate(bookings, date)
          .filter((booking) => booking.courtId === court.id)
          .filter((booking) => isActiveBookingStatus(booking.bookingStatus));
        map.set(key, dayBookings);
      });
    });

    return map;
  }, [bookings, courts, weekDates]);

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
            onClick={() => setAnchorDate(shiftWeek(anchorDate, -1))}
          >
            Tuần trước
          </Button>
          <Button
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={() => setAnchorDate(todayIsoDate())}
          >
            Tuần này
          </Button>
          <Button
            variant="outlined"
            endIcon={<ChevronRightIcon />}
            onClick={() => setAnchorDate(shiftWeek(anchorDate, 1))}
          >
            Tuần sau
          </Button>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {weekLabel}
          </Typography>
        </Stack>
      </Stack>

      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold", minWidth: 100 }}>Sân</TableCell>
              {weekDates.map((date, index) => (
                <TableCell key={date} sx={{ fontWeight: "bold", minWidth: 110 }}>
                  {WEEKDAY_SHORT[index]}
                  <Typography variant="caption" display="block">
                    {formatDisplayDate(date)}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {courts.map((court, index) => (
              <TableRow key={court.id}>
                <TableCell sx={{ fontWeight: "medium" }}>
                  {getCourtDisplayName(court, index)}
                </TableCell>
                {weekDates.map((date) => {
                  const dayBookings = cellBookings.get(`${court.id}-${date}`) || [];

                  return (
                    <TableCell
                      key={`${court.id}-${date}`}
                      sx={{
                        verticalAlign: "top",
                        bgcolor: dayBookings.length > 0 ? "#e3f2fd" : "inherit",
                      }}
                    >
                      {dayBookings.length === 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      ) : (
                        <Stack spacing={0.5}>
                          {dayBookings.map((booking) => (
                            <Chip
                              key={booking.id}
                              size="small"
                              label={`${booking.startTime} ${booking.customerName}`}
                              onClick={() => setDetailBooking(booking)}
                              sx={{ justifyContent: "flex-start", maxWidth: "100%" }}
                            />
                          ))}
                        </Stack>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
