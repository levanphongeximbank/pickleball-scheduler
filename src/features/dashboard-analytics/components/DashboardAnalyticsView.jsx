import { useMemo } from "react";
import { Navigate } from "react-router-dom";

import { Alert, Box, Button, Grid, Typography } from "@mui/material";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";

import { useAuth } from "../../../context/AuthContext.jsx";
import { ROLE_LABELS } from "../../../auth/roles.js";
import { useClub } from "../../../context/ClubContext.jsx";
import {
  REPORTING_PRESENTATION_SOURCE_STATE,
} from "../../reporting-analytics/index.js";
import { useDashboardAnalytics } from "../hooks/useDashboardAnalytics.js";
import DashboardTimeFilter from "./DashboardTimeFilter.jsx";
import DashboardOverviewKpis from "./DashboardOverviewKpis.jsx";
import RevenueChart from "./RevenueChart.jsx";
import CourtHeatmap from "./CourtHeatmap.jsx";
import DashboardRecentBookingsTable from "./DashboardRecentBookingsTable.jsx";
import DashboardUpcomingTournamentsTable from "./DashboardUpcomingTournamentsTable.jsx";
import DashboardRevenueBreakdown from "./DashboardRevenueBreakdown.jsx";
import {
  AuthEmptyState,
  AuthErrorState,
  AuthFilterBar,
  AuthLoadingState,
  AuthPageHeader,
} from "../../web-app-ui/index.js";
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

  const analytics = useDashboardAnalytics({
    clubId: activeClubId,
    user,
    can,
    scope,
    mode: "live",
  });
  const { access, data, loading, error, reload, isEmpty, sourceState } = analytics;

  if (!access.allowed) {
    return <Navigate to="/403" replace />;
  }

  const showDemoBanner =
    sourceState?.state === REPORTING_PRESENTATION_SOURCE_STATE.MOCK ||
    sourceState?.state === REPORTING_PRESENTATION_SOURCE_STATE.PREVIEW;

  const showLivePartial =
    sourceState?.state === REPORTING_PRESENTATION_SOURCE_STATE.PARTIAL ||
    sourceState?.state === REPORTING_PRESENTATION_SOURCE_STATE.MIXED;

  return (
    <Box sx={{ mb: 3, maxWidth: "100%" }}>
      <AuthPageHeader
        title="Tổng quan"
        subtitle={`Chào mừng trở lại, ${user?.displayName || ROLE_LABELS[user?.role] || "Admin"}! Đây là tổng quan hoạt động của hệ thống${activeClub?.name ? ` — ${activeClub.name}` : ""}.`}
        context={
          <Typography variant="caption" color="text.secondary">
            Phần vận hành CLB bên dưới (nếu có) là nguồn riêng — không đồng nghĩa toàn bộ trang đang dùng báo cáo trực tiếp.
          </Typography>
        }
        primaryAction={
          analytics.timeRange ? (
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
              {`${analytics.timeRange.from} → ${analytics.timeRange.to}`}
            </Button>
          ) : null
        }
      />

      <AuthFilterBar
        dateControls={
          <DashboardTimeFilter
        preset={analytics.preset}
        onPresetChange={analytics.setPreset}
        customFrom={analytics.customFrom}
        customTo={analytics.customTo}
        onCustomFromChange={analytics.setCustomFrom}
        onCustomToChange={analytics.setCustomTo}
        sourceState={sourceState}
        onRefresh={reload}
      />
        }
      />

      {loading && <AuthLoadingState label="Đang tải dữ liệu dashboard…" />}

      {!loading && error && (
        <AuthErrorState
          title="Không tải được dashboard"
          message={error}
          onRetry={reload}
        />
      )}

      {!loading && !error && isEmpty && (
        <AuthEmptyState
          title="Chưa có dữ liệu dashboard"
          description="Thêm booking, người chơi hoặc phiên xếp sân để xem số liệu trực tiếp. Hệ thống không hiển thị KPI demo khi nguồn trống."
        />
      )}

      {!loading && !error && !isEmpty && data && (
        <>
          {showDemoBanner && (
            <Alert severity="warning" sx={{ mb: 2 }} role="status">
              Dashboard đang ở chế độ {sourceState.label}. Đây không phải dữ liệu vận hành
              trực tiếp.
            </Alert>
          )}

          {showLivePartial && (
            <Alert severity="info" sx={{ mb: 2 }} role="status">
              Một số chỉ số chưa có nguồn thật nên được đánh dấu một phần / không khả dụng —
              không hiển thị số giả dưới trạng thái LIVE.
            </Alert>
          )}

          {data.summary && (
            <DashboardOverviewKpis summary={data.summary} sections={access.sections} />
          )}

          <Grid container spacing={DASHBOARD_LAYOUT.gridSpacing} sx={{ mb: DASHBOARD_LAYOUT.sectionGap }}>
            {access.sections.revenue && data.revenueSeries?.length > 0 && (
              <Grid size={{ xs: 12, lg: 7 }}>
                <RevenueChart series={data.revenueSeries} />
              </Grid>
            )}
            {access.sections.heatmap && data.heatmap?.cells?.length > 0 && (
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
            {access.sections.revenue && data.summary && (
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

