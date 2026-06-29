import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import { loadBookingsForClub } from "../../domain/clubStorage.js";
import {
  computeDailyRevenue,
  computeDebtSummary,
  formatCurrency,
  getTodayUpcomingBookings,
} from "../../domain/courtBookingEngine.js";
import { formatTimeRange, todayIsoDate } from "../../pages/courtManagement/courtManagement.constants.js";

function MiniStat({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight="bold">
        {value}
      </Typography>
    </Box>
  );
}

export default function CourtOperationsPanel({ clubId, revision = 0 }) {
  const today = todayIsoDate();
  const now = useMemo(() => new Date(), [revision, today]);

  const { summary, debtSummary, upcoming } = useMemo(() => {
    const bookings = loadBookingsForClub(clubId);
    return {
      summary: computeDailyRevenue(bookings, today),
      debtSummary: computeDebtSummary(bookings),
      upcoming: getTodayUpcomingBookings(bookings, today, now),
    };
  }, [clubId, revision, today, now]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Quản lý sân hôm nay
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Booking thuê sân · {today.split("-").reverse().join("/")}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button component={RouterLink} to="/court-management" variant="contained" size="small">
              Trạng thái sân
            </Button>
            <Button
              component={RouterLink}
              to="/court-management/calendar"
              variant="outlined"
              size="small"
            >
              Lịch sân
            </Button>
            <Button
              component={RouterLink}
              to="/court-management/bookings"
              variant="outlined"
              size="small"
            >
              Booking
            </Button>
            <Button
              component={RouterLink}
              to="/court-management/revenue"
              variant="outlined"
              size="small"
            >
              Công nợ
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={2} sx={{ mb: upcoming.length > 0 ? 2 : 0 }}>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <MiniStat label="Booking" value={summary.totalBookings} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <MiniStat label="Đang chơi" value={summary.playing} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <MiniStat label="Hoàn thành" value={summary.completed} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <MiniStat label="Dự kiến" value={`${formatCurrency(summary.expectedRevenue)} đ`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <MiniStat label="Đã thu" value={`${formatCurrency(summary.collected)} đ`} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <MiniStat
              label="Còn nợ"
              value={`${formatCurrency(debtSummary.totalDebt)} đ`}
            />
          </Grid>
        </Grid>

        {upcoming.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Booking sắp tới
            </Typography>
            <Stack spacing={0.5}>
              {upcoming.map((booking) => (
                <Typography key={booking.id} variant="body2" color="text.secondary">
                  {booking.startTime} · {booking.customerName} · {booking.courtName}
                  {" · "}
                  {formatTimeRange(booking.startTime, booking.endTime)}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
