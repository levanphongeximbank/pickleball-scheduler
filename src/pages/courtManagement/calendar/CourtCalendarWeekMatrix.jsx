import { useMemo, useState } from "react";

import {
  Box,
  Chip,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { getCourtDisplayName } from "../../../models/court.js";
import { getBookingsByDate, getWeekDates } from "../../../domain/courtBookingEngine.js";
import { isActiveBookingStatus } from "../../../models/booking.js";
import { formatDisplayDate } from "../courtManagement.constants.js";
import { CALENDAR_SHELL } from "./courtCalendarTokens.js";

const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function OccupancyDots({ bookings, openHour = 6, closeHour = 22 }) {
  const peakHours = 8;
  const startHour = Math.max(openHour, 8);
  const dots = [];

  for (let index = 0; index < peakHours; index += 1) {
    const hour = startHour + index;
    const hasBooking = bookings.some((booking) => {
      const start = Number(booking.startTime?.slice(0, 2));
      const end = Number(booking.endTime?.slice(0, 2));
      return hour >= start && hour < end;
    });
    dots.push(hasBooking);
  }

  return (
    <Stack direction="row" spacing={0.4} sx={{ mt: 0.75 }}>
      {dots.map((active, index) => (
        <Box
          key={index}
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: active ? CALENDAR_SHELL.primary : "action.hover",
          }}
        />
      ))}
    </Stack>
  );
}

export default function CourtCalendarWeekMatrix({
  courts = [],
  bookings = [],
  anchorDate,
  openHour = 6,
  closeHour = 22,
  onOpenDay,
  onBookingClick,
}) {
  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate]);
  const [drawer, setDrawer] = useState(null);

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
      <Paper
        elevation={0}
        sx={{
          border: CALENDAR_SHELL.cardBorder,
          borderRadius: `${CALENDAR_SHELL.cardRadius}px`,
          boxShadow: CALENDAR_SHELL.cardShadow,
          overflow: "auto",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `160px repeat(7, minmax(120px, 1fr))`,
            minWidth: 900,
          }}
        >
          <Box
            sx={{
              p: 1.25,
              fontWeight: 700,
              borderBottom: 1,
              borderRight: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
              position: "sticky",
              left: 0,
              zIndex: 2,
            }}
          >
            Sân
          </Box>

          {weekDates.map((date, index) => (
            <Box
              key={date}
              sx={{
                p: 1,
                borderBottom: 1,
                borderRight: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                textAlign: "center",
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                {WEEKDAY_SHORT[index]}
              </Typography>
              <Typography variant="subtitle2" fontWeight={700}>
                {formatDisplayDate(date)}
              </Typography>
            </Box>
          ))}

          {courts.map((court, courtIndex) => (
            <Box key={court.id} sx={{ display: "contents" }}>
              <Box
                sx={{
                  p: 1.25,
                  borderBottom: 1,
                  borderRight: 1,
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  {getCourtDisplayName(court, courtIndex)}
                </Typography>
              </Box>

              {weekDates.map((date) => {
                const key = `${court.id}-${date}`;
                const dayBookings = cellBookings.get(key) || [];
                const visible = dayBookings.slice(0, 2);
                const overflow = dayBookings.length - visible.length;

                return (
                  <Box
                    key={key}
                    onClick={() =>
                      setDrawer({
                        court,
                        date,
                        bookings: dayBookings,
                      })
                    }
                    sx={{
                      p: 1,
                      borderBottom: 1,
                      borderRight: 1,
                      borderColor: "divider",
                      minHeight: 96,
                      cursor: "pointer",
                      transition: "background-color 0.15s",
                      "&:hover": { bgcolor: "rgba(16, 185, 129, 0.06)" },
                    }}
                  >
                    <OccupancyDots bookings={dayBookings} openHour={openHour} closeHour={closeHour} />
                    <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                      {visible.map((booking) => (
                        <Chip
                          key={booking.id}
                          size="small"
                          label={`${booking.startTime} ${booking.customerName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onBookingClick?.(booking);
                          }}
                          sx={{
                            justifyContent: "flex-start",
                            height: "auto",
                            py: 0.5,
                            "& .MuiChip-label": { whiteSpace: "normal" },
                          }}
                        />
                      ))}
                      {overflow > 0 && (
                        <Typography variant="caption" color="primary.main" fontWeight={700}>
                          +{overflow} booking
                        </Typography>
                      )}
                      {dayBookings.length === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Trống
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Paper>

      <Drawer
        anchor="right"
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 380 } } }}
      >
        {drawer && (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={800}>
              {getCourtDisplayName(drawer.court)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {formatDisplayDate(drawer.date)}
            </Typography>

            <List dense>
              {drawer.bookings.length === 0 ? (
                <Typography color="text.secondary">Không có booking.</Typography>
              ) : (
                drawer.bookings.map((booking) => (
                  <ListItemButton
                    key={booking.id}
                    onClick={() => {
                      onBookingClick?.(booking);
                      setDrawer(null);
                    }}
                  >
                    <ListItemText
                      primary={booking.customerName}
                      secondary={`${booking.startTime} – ${booking.endTime}`}
                    />
                  </ListItemButton>
                ))
              )}
            </List>

            <Chip
              label="Xem theo ngày"
              color="primary"
              onClick={() => {
                onOpenDay?.(drawer.date);
                setDrawer(null);
              }}
              sx={{ mt: 2, fontWeight: 700 }}
            />
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
