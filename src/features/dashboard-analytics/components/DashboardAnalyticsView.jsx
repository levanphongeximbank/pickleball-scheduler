import { useMemo } from "react";
import { Navigate } from "react-router-dom";

import { Alert, Box, Button, Grid, Stack, Typography } from "@mui/material";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";

import { useAuth } from "../../../context/AuthContext.jsx";
import { ROLE_LABELS } from "../../../auth/roles.js";
import { useClub } from "../../../context/ClubContext.jsx";
import { useDashboardAnalytics } from "../hooks/useDashboardAnalytics.js";
import DashboardTimeFilter from "./DashboardTimeFilter.jsx";
import DashboardOverviewKpis from "./DashboardOverviewKpis.jsx";
import RevenueChart from "./RevenueChart.jsx";
import CourtHeatmap from "./CourtHeatmap.jsx";
import DashboardRecentBookingsTable from "./DashboardRecentBookingsTable.jsx";
import DashboardUpcomingTournamentsTable from "./DashboardUpcomingTournamentsTable.jsx";
import DashboardRevenueBreakdown from "./DashboardRevenueBreakdown.jsx";
import {
  DashboardErrorState,
  DashboardLoadingState,
} from "./DashboardEmptyState.jsx";
import { DASHBOARD_LAYOUT } from "../constants/dashboardLayout.js";
import { ActionQueuePanel } from "../../action-queue/index.js";

export default function DashboardAnalyticsView() {
  const { user, can } = useAuth();
  const { activeClubId, activeClub } = useClub();

  const scopeClubId = activeClubId;
  const scopeVenueId =
    activeClub?.venueId || activeClub?.tenantId || user?.venueId || user?.tenantId || null;
  const scopeTenantId =
    activeClub?.tenantId || activeClub?.venueId || user?.tenantId || user?.venueId || null;

  const scope = useMemo(
    () => ({
      clubId: scopeClubId,
      venueId: scopeVenueId,
      tenantId: scopeTenantId,
    }),
    [scopeClubId, scopeVenueId, scopeTenantId]
  );

  const analytics = useDashboardAnalytics({ clubId: activeClubId, user, can, scope });
  const { access, data, loading, error, reload } = analytics;

  if (!access.allowed) {
    return <Navigate to="/403" replace />;
  }

  return (
    <Box sx={{ mb: 3, maxWidth: "100%" }}>
      <StackHeader
        activeClub={activeClub}
        user={user}
        timeRange={analytics.timeRange}
      />

      <DashboardTimeFilter
        preset={analytics.preset}
        onPresetChange={analytics.setPreset}
        customFrom={analytics.customFrom}
        customTo={analytics.customTo}
        onCustomFromChange={analytics.setCustomFrom}
        onCustomToChange={analytics.setCustomTo}
        isMock={data?.isMock}
        onRefresh={reload}
      />

      {loading && <DashboardLoadingState />}

      {!loading && error && <DashboardErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          {data.isMock && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Dashboard đang dùng dữ liệu demo. Thêm booking và người chơi để xem số liệu thật.
            </Alert>
          )}

          <DashboardOverviewKpis summary={data.summary} sections={access.sections} />

          <Grid container spacing={DASHBOARD_LAYOUT.gridSpacing} sx={{ mb: DASHBOARD_LAYOUT.sectionGap }}>
            {access.sections.revenue && (
              <Grid size={{ xs: 12, lg: 7 }}>
                <RevenueChart series={data.revenueSeries} />
              </Grid>
            )}
            {access.sections.heatmap && (
              <Grid size={{ xs: 12, lg: access.sections.revenue ? 5 : 12 }}>
                <CourtHeatmap heatmap={data.heatmap} />
              </Grid>
            )}
          </Grid>

          <Grid container spacing={DASHBOARD_LAYOUT.gridSpacing}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <ActionQueuePanel clubId={activeClubId} />
            </Grid>
            {(access.sections.courts || access.sections.customers) && (
              <Grid size={{ xs: 12, lg: 4 }}>
                <DashboardRecentBookingsTable rows={data.recentBookings} />
              </Grid>
            )}
            {access.sections.clubs && (
              <Grid size={{ xs: 12, lg: 4 }}>
                <DashboardUpcomingTournamentsTable rows={data.upcomingTournaments} />
              </Grid>
            )}
            {access.sections.revenue && (
              <Grid size={{ xs: 12, lg: 12 }}>
                <DashboardRevenueBreakdown summary={data.summary} />
              </Grid>
            )}
          </Grid>
        </>
      )}
    </Box>
  );
}

function StackHeader({ activeClub, user, timeRange }) {
  const displayName = user?.displayName || ROLE_LABELS[user?.role] || "Admin";
  const dateLabel = timeRange ? `${timeRange.from} → ${timeRange.to}` : "";

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.5}
      sx={{ mb: 2, alignItems: { md: "flex-start" }, justifyContent: "space-between" }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, mb: 0.75 }}>
          Tổng quan
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 14, lineHeight: 1.5 }}>
          Chào mừng trở lại, {displayName}! Đây là tổng quan hoạt động của hệ thống
          {activeClub?.name ? ` — ${activeClub.name}` : ""}.
        </Typography>
      </Box>

      {dateLabel && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />}
          sx={{
            flexShrink: 0,
            borderRadius: 1.5,
            textTransform: "none",
            fontWeight: 600,
            fontSize: 13,
            py: 0.75,
            color: "text.secondary",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          {dateLabel}
        </Button>
      )}
    </Stack>
  );
}
