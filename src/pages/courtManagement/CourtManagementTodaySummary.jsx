import { useMemo } from "react";

import { Card, CardContent, Grid, Typography } from "@mui/material";

import { summarizeTodayOperations, formatCurrency } from "../../domain/courtBookingEngine.js";
import { todayIsoDate } from "./courtManagement.constants.js";

function StatTile({ label, value, hint }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" fontWeight="bold" sx={{ mt: 0.5 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function CourtManagementTodaySummary({ bookings = [] }) {
  const today = todayIsoDate();
  const summary = useMemo(
    () => summarizeTodayOperations(bookings, today),
    [bookings, today]
  );

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Booking hôm nay" value={summary.totalBookings} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Đang chơi" value={summary.playing} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Sắp tới" value={summary.upcomingCount} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Dự kiến" value={`${formatCurrency(summary.expectedRevenue)} đ`} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Đã thu" value={`${formatCurrency(summary.collected)} đ`} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile
          label="Công nợ"
          value={`${formatCurrency(summary.totalDebt)} đ`}
          hint={`${summary.debtBookingCount} booking`}
        />
      </Grid>
    </Grid>
  );
}
