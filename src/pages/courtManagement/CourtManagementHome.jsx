import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";

import { Box, Grid } from "@mui/material";

import LiveCourtsHero from "../../components/courts/LiveCourtsHero.jsx";
import CourtStats from "../../components/courts/CourtStats.jsx";
import DirectorSuggestionPanel from "../../components/courts/DirectorSuggestionPanel.jsx";
import CourtStatusBoard from "./CourtStatusBoard.jsx";
import MyFacilityPanel from "../../features/court-cluster/components/MyFacilityPanel.jsx";
import { isCourtClustersEnabled } from "../../features/court-cluster/config/clusterFlags.js";
import {
  computeCourtDashboardStats,
  generateDirectorSuggestions,
} from "../../utils/courtHelpers.js";
import { loadPlayersForClub } from "../../domain/clubStorage.js";

export default function CourtManagementHome() {
  const { clubId, courts, bookings, onRefresh } = useOutletContext();
  const now = useMemo(() => new Date(), [bookings, courts]);

  const stats = useMemo(
    () => computeCourtDashboardStats(courts, bookings, now, { clubId }),
    [courts, bookings, now, clubId]
  );

  const players = useMemo(() => loadPlayersForClub(clubId), [clubId]);

  const suggestions = useMemo(
    () => generateDirectorSuggestions({ courts, bookings, players, now, clubId }),
    [courts, bookings, players, now, clubId]
  );

  return (
    <Box>
      {isCourtClustersEnabled() && <MyFacilityPanel />}
      <LiveCourtsHero />
      <CourtStats stats={stats} />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <CourtStatusBoard
            clubId={clubId}
            courts={courts}
            bookings={bookings}
            onRefresh={onRefresh}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 3 }}>
          <DirectorSuggestionPanel suggestions={suggestions} />
        </Grid>
      </Grid>
    </Box>
  );
}
