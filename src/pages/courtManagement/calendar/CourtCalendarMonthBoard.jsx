import { useMemo } from "react";

import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import {
  getBookingsByDate,
  getMonthCalendarDates,
} from "../../../domain/courtBookingEngine.js";
import { isActiveBookingStatus } from "../../../models/booking.js";
import { todayIsoDate } from "../courtManagement.constants.js";
import { CALENDAR_SHELL } from "./courtCalendarTokens.js";

const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function CourtCalendarMonthBoard({
  bookings = [],
  anchorDate,
  onEmptyDayClick,
  onBookingClick,
}) {
  const monthCells = useMemo(() => getMonthCalendarDates(anchorDate), [anchorDate]);
  const [year, month] = anchorDate.split("-").map(Number);

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

  const weeks = useMemo(() => {
    const rows = [];
    for (let index = 0; index < monthCells.length; index += 7) {
      rows.push(monthCells.slice(index, index + 7));
    }
    return rows;
  }, [monthCells]);

  const monthOccupancy = useMemo(() => {
    const inMonthDates = monthCells.filter((cell) => cell.inMonth).map((cell) => cell.date);
    const totalSlots = inMonthDates.length * 8;
    let booked = 0;

    inMonthDates.forEach((date) => {
      booked += (bookingsByDate.get(date) || []).length;
    });

    return totalSlots > 0 ? Math.min(100, Math.round((booked / totalSlots) * 100)) : 0;
  }, [bookingsByDate, monthCells]);

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          border: CALENDAR_SHELL.cardBorder,
          borderRadius: `${CALENDAR_SHELL.cardRadius}px`,
          boxShadow: CALENDAR_SHELL.cardShadow,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
          }}
        >
          {WEEKDAY_SHORT.map((label) => (
            <Box
              key={label}
              sx={{
                p: 1,
                textAlign: "center",
                fontWeight: 700,
                borderBottom: 1,
                borderRight: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              {label}
            </Box>
          ))}

          {weeks.map((week, weekIndex) =>
            week.map(({ date, inMonth }) => {
              const dayBookings = bookingsByDate.get(date) || [];
              const dayNumber = Number(date.split("-")[2]);
              const isToday = date === todayIsoDate();
              const visible = dayBookings.slice(0, 3);
              const overflow = dayBookings.length - visible.length;
              const occupancy =
                dayBookings.length > 0 ? Math.min(100, dayBookings.length * 12) : 0;

              return (
                <Box
                  key={`${weekIndex}-${date}`}
                  onClick={() => {
                    if (dayBookings.length === 0) {
                      onEmptyDayClick?.(date);
                    }
                  }}
                  sx={{
                    minHeight: 108,
                    p: 1,
                    borderBottom: 1,
                    borderRight: 1,
                    borderColor: "divider",
                    bgcolor: inMonth ? "background.paper" : "action.hover",
                    opacity: inMonth ? 1 : 0.45,
                    cursor: dayBookings.length === 0 && inMonth ? "pointer" : "default",
                    outline: isToday ? `2px solid ${CALENDAR_SHELL.primary}` : "none",
                    outlineOffset: -2,
                    transition: "background-color 0.15s",
                    "&:hover":
                      dayBookings.length === 0 && inMonth
                        ? { bgcolor: "rgba(16, 185, 129, 0.06)" }
                        : undefined,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={isToday ? 800 : 600}>
                      {dayNumber}
                    </Typography>
                    {inMonth && dayBookings.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {month === Number(date.split("-")[1]) ? "" : ""}
                      </Typography>
                    )}
                  </Stack>

                  {inMonth && (
                    <Box
                      sx={{
                        mt: 0.75,
                        mb: 0.75,
                        height: 4,
                        borderRadius: 999,
                        bgcolor: "action.hover",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          width: `${occupancy}%`,
                          height: "100%",
                          bgcolor: CALENDAR_SHELL.primary,
                          borderRadius: 999,
                        }}
                      />
                    </Box>
                  )}

                  <Stack spacing={0.35}>
                    {visible.map((booking) => (
                      <Typography
                        key={booking.id}
                        variant="caption"
                        onClick={(event) => {
                          event.stopPropagation();
                          onBookingClick?.(booking);
                        }}
                        sx={{
                          display: "block",
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: "rgba(16, 185, 129, 0.1)",
                          color: "text.primary",
                          cursor: "pointer",
                          "&:hover": { bgcolor: "rgba(16, 185, 129, 0.18)" },
                        }}
                      >
                        {booking.startTime} {booking.courtName} · {booking.customerName}
                      </Typography>
                    ))}
                    {overflow > 0 && (
                      <Chip size="small" label={`${dayBookings.length} lịch`} sx={{ height: 22 }} />
                    )}
                  </Stack>
                </Box>
              );
            })
          )}
        </Box>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
        Tháng {month}/{year} · ~{monthOccupancy}% ngày có booking
      </Typography>
    </Box>
  );
}
