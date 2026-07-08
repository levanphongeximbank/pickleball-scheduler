import { useMemo } from "react";

import { Box, Paper, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import { getCourtDisplayName } from "../../../models/court.js";
import {
  buildDayGridBlocks,
  buildHourSlots,
  getCalendarCellStatus,
} from "../../../domain/courtBookingEngine.js";
import { PAYMENT_STATUS_LABELS } from "../courtManagement.constants.js";
import {
  CALENDAR_SHELL,
  getCellToneStyle,
  PAYMENT_PILL_COLORS,
} from "./courtCalendarTokens.js";
import CourtCalendarLegend from "./CourtCalendarLegend.jsx";

const COURT_TYPE_LABELS = Object.freeze({
  indoor: "Trong nhà",
  outdoor: "Ngoài trời",
});

function PaymentPill({ paymentStatus }) {
  const colors = PAYMENT_PILL_COLORS[paymentStatus] || PAYMENT_PILL_COLORS.unpaid;
  const label = PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus;

  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 0.75,
        py: 0.15,
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        bgcolor: colors.bg,
        color: colors.color,
        mt: 0.5,
      }}
    >
      {label}
    </Box>
  );
}

export default function CourtCalendarDayGrid({
  courts = [],
  bookings = [],
  selectedDate,
  openHour = 6,
  closeHour = 22,
  slotMinutes = 60,
  clusterNameById = {},
  isToday = false,
  nowSlotIndex = -1,
  onEmptyCellClick,
  onBookingClick,
}) {
  const hourSlots = useMemo(
    () => buildHourSlots(openHour, closeHour, slotMinutes),
    [openHour, closeHour, slotMinutes]
  );

  const dayBookings = useMemo(
    () => bookings.filter((booking) => booking.date === selectedDate),
    [bookings, selectedDate]
  );

  const gridBlocks = useMemo(
    () => buildDayGridBlocks(dayBookings, courts, selectedDate, hourSlots, slotMinutes),
    [dayBookings, courts, selectedDate, hourSlots, slotMinutes]
  );

  const columnTemplate = `72px repeat(${Math.max(courts.length, 1)}, minmax(140px, 1fr))`;

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
            overflow: "auto",
            maxHeight: { xs: "70vh", lg: "calc(100vh - 320px)" },
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: columnTemplate,
              minWidth: courts.length > 4 ? courts.length * 150 + 72 : "100%",
            }}
          >
            <Box
              sx={{
                position: "sticky",
                top: 0,
                left: 0,
                zIndex: 3,
                bgcolor: "background.paper",
                borderBottom: 1,
                borderRight: 1,
                borderColor: "divider",
                px: 1,
                py: 1.25,
                fontWeight: 700,
              }}
            >
              Giờ
            </Box>

            {courts.map((court, index) => {
              const clusterLabel = clusterNameById[court.clusterId];
              return (
                <Box
                  key={court.id}
                  sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    bgcolor: "background.paper",
                    borderBottom: 1,
                    borderRight: 1,
                    borderColor: "divider",
                    px: 1,
                    py: 1,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={800}>
                    {getCourtDisplayName(court, index)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {COURT_TYPE_LABELS[court.courtType] || "Sân"}
                  </Typography>
                  {clusterLabel && (
                    <Typography variant="caption" color="primary.main" display="block">
                      {clusterLabel}
                    </Typography>
                  )}
                </Box>
              );
            })}

            {hourSlots.map((slotTime, rowIndex) => (
              <Box key={`row-${slotTime}`} sx={{ display: "contents" }}>
                <Box
                  sx={{
                    position: "sticky",
                    left: 0,
                    zIndex: 1,
                    bgcolor: "background.paper",
                    borderRight: 1,
                    borderBottom: 1,
                    borderColor: "divider",
                    px: 1,
                    py: 1,
                    fontWeight: 600,
                    fontSize: 13,
                    color: "text.secondary",
                    minHeight: 56,
                    display: "flex",
                    alignItems: "flex-start",
                  }}
                >
                  {slotTime}
                </Box>

                {courts.map((court) => {
                  const key = `${court.id}::${slotTime}`;
                  const block = gridBlocks.get(key);

                  if (!block || block.type === "skip") {
                    return null;
                  }

                  const status = getCalendarCellStatus(
                    block.type === "booking" ? block.booking : null,
                    court
                  );
                  const tone = getCellToneStyle(status.tone);
                  const isNowLine = isToday && nowSlotIndex === rowIndex;

                  if (block.type === "booking") {
                    const booking = block.booking;
                    return (
                      <Box
                        key={key}
                        onClick={() => onBookingClick?.(booking)}
                        sx={{
                          gridRow: `span ${block.rowSpan}`,
                          borderRight: 1,
                          borderBottom: 1,
                          borderColor: "divider",
                          bgcolor: tone.bg,
                          color: tone.color,
                          borderLeft: `3px solid ${tone.border}`,
                          p: 1,
                          cursor: "pointer",
                          minHeight: 56 * block.rowSpan,
                          transition: "box-shadow 0.15s",
                          "&:hover": {
                            boxShadow: CALENDAR_SHELL.cardShadow,
                          },
                        }}
                      >
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {booking.customerName}
                        </Typography>
                        <Typography variant="caption" display="block">
                          {booking.startTime} – {booking.endTime}
                        </Typography>
                        <PaymentPill paymentStatus={booking.paymentStatus} />
                      </Box>
                    );
                  }

                  const isBlocked =
                    court.status === "locked" ||
                    court.status === "maintenance" ||
                    court.active === false;

                  return (
                    <Box
                      key={key}
                      onClick={() => {
                        if (!isBlocked) {
                          onEmptyCellClick?.(court, slotTime);
                        }
                      }}
                      sx={{
                        borderRight: 1,
                        borderBottom: 1,
                        borderColor: "divider",
                        bgcolor: tone.bg,
                        color: tone.color,
                        minHeight: 56,
                        p: 1,
                        cursor: isBlocked ? "not-allowed" : "pointer",
                        position: "relative",
                        backgroundImage: isBlocked
                          ? "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.04) 6px, rgba(0,0,0,0.04) 12px)"
                          : "none",
                        transition: "background-color 0.15s, border-color 0.15s",
                        "&:hover": isBlocked
                          ? {}
                          : {
                              bgcolor: tone.hoverBg || tone.bg,
                              outline: `2px solid ${tone.hoverBorder || CALENDAR_SHELL.primary}`,
                              outlineOffset: -2,
                            },
                      }}
                    >
                      {isNowLine && (
                        <Box
                          sx={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: 0,
                            height: 2,
                            bgcolor: CALENDAR_SHELL.nowLine,
                            opacity: 0.85,
                            zIndex: 1,
                          }}
                        />
                      )}
                      {!isBlocked ? (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 0.5,
                          }}
                        >
                          <Typography variant="body2">{status.label}</Typography>
                          <AddIcon sx={{ fontSize: 16, opacity: 0.45 }} />
                        </Box>
                      ) : (
                        <Typography variant="body2" fontWeight={600}>
                          {status.label}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>

      <CourtCalendarLegend />
    </Box>
  );
}
