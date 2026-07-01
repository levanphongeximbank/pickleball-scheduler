import { useMemo } from "react";
import { Navigate } from "react-router-dom";

import { Alert, Box, Grid, Stack, Typography } from "@mui/material";
import AnalyticsOutlinedIcon from "@mui/icons-material/AnalyticsOutlined";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useClub } from "../../../context/ClubContext.jsx";
import { useDashboardAnalytics } from "../hooks/useDashboardAnalytics.js";
import DashboardTimeFilter from "./DashboardTimeFilter.jsx";
import DashboardKpiPanels from "./DashboardKpiPanels.jsx";
import RevenueChart from "./RevenueChart.jsx";
import PlayerAnalyticsSection from "./PlayerAnalyticsSection.jsx";
import TopPlayersTable from "./TopPlayersTable.jsx";
import TopCourtsTable from "./TopCourtsTable.jsx";
import CourtHeatmap from "./CourtHeatmap.jsx";
import PeakHoursPanel from "./PeakHoursPanel.jsx";
import OperationalInsightsPanel from "./OperationalInsightsPanel.jsx";
import {
  DashboardErrorState,
  DashboardLoadingState,
} from "./DashboardEmptyState.jsx";

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
    <Box sx={{ mb: 4 }}>
      <StackHeader activeClub={activeClub} scopeLabel={access.scopeLabel} />

      <DashboardTimeFilter
        preset={analytics.preset}
        onPresetChange={analytics.setPreset}
        customFrom={analytics.customFrom}
        customTo={analytics.customTo}
        onCustomFromChange={analytics.setCustomFrom}
        onCustomToChange={analytics.setCustomTo}
        timeRange={analytics.timeRange}
        scopeLabel={access.scopeLabel}
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

          <DashboardKpiPanels summary={data.summary} sections={access.sections} />

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {access.sections.revenue && (
              <Grid size={{ xs: 12, lg: 8 }}>
                <RevenueChart series={data.revenueSeries} />
              </Grid>
            )}
            {access.sections.peakHours && (
              <Grid size={{ xs: 12, lg: access.sections.revenue ? 4 : 12 }}>
                <PeakHoursPanel peakHours={data.peakHours} />
              </Grid>
            )}
          </Grid>

          {access.sections.customers && (
            <Box sx={{ mb: 3 }}>
              <PlayerAnalyticsSection
                newCustomersSeries={data.newCustomersSeries}
                skillDistribution={data.skillDistribution}
                genderDistribution={data.genderDistribution}
              />
            </Box>
          )}

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {access.sections.topPlayers && (
              <Grid size={{ xs: 12, lg: 6 }}>
                <TopPlayersTable rows={data.topPlayers} />
              </Grid>
            )}
            {access.sections.courts && (
              <Grid size={{ xs: 12, lg: access.sections.topPlayers ? 6 : 12 }}>
                <TopCourtsTable rows={data.topCourts} />
              </Grid>
            )}
          </Grid>

          {access.sections.heatmap && (
            <Box sx={{ mb: 3 }}>
              <CourtHeatmap heatmap={data.heatmap} />
            </Box>
          )}

          {access.sections.insights && (
            <OperationalInsightsPanel insights={data.insights} />
          )}
        </>
      )}
    </Box>
  );
}

function StackHeader({ activeClub, scopeLabel }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
        <AnalyticsOutlinedIcon color="primary" />
        <Typography variant="h4" fontWeight="bold">
          Dashboard Analytics
        </Typography>
      </Stack>
      <Typography color="text.secondary">
        {activeClub?.name || "Hệ thống"} • {scopeLabel}
      </Typography>
    </Box>
  );
}
