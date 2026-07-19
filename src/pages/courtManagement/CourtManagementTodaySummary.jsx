import { useMemo } from "react";

import { Card, CardContent, Grid, Typography } from "@mui/material";

import { summarizeTodayOperations, formatCurrency } from "../../domain/courtBookingEngine.js";
import { resolveVenueTimezoneForClub } from "../../domain/civilTime.js";
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

export default function CourtManagementTodaySummary({ bookings = [], clubId = null }) {
  const tz = clubId ? resolveVenueTimezoneForClub(clubId) : { ok: false };
  const today = tz.ok
    ? todayIsoDate({ timezone: tz.timezone })
    : todayIsoDate({ allowBrowserLocal: true });

  const summary = useMemo(() => {
    if (!tz.ok) {
      return {
        totalBookings: 0,
        upcomingCount: 0,
        totalRevenue: 0,
        totalDebt: 0,
        debtBookingCount: 0,
        paidAmount: 0,
      };
    }
    return summarizeTodayOperations(bookings, today, new Date(), {
      timezone: tz.timezone,
    });
  }, [bookings, today, tz.ok, tz.timezone]);

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Booking hôm nay" value={summary.totalBookings} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Sắp tới" value={summary.upcomingCount} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Doanh thu" value={formatCurrency(summary.totalRevenue || 0)} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile
          label="Công nợ"
          value={formatCurrency(summary.totalDebt || 0)}
          hint={`${summary.debtBookingCount || 0} booking`}
        />
      </Grid>
    </Grid>
  );
}
