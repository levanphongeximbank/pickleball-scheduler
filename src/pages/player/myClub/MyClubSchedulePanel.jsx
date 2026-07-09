import { Grid } from "@mui/material";

import MyClubOrgChart from "./MyClubOrgChart.jsx";
import MyClubWeeklySchedule from "./MyClubWeeklySchedule.jsx";
import MyClubSeasonLeagueSection from "./MyClubSeasonLeagueSection.jsx";

export default function MyClubSchedulePanel({
  clubId,
  tenantId,
  user,
  clubRecord,
  revision = 0,
  onRevision,
  onMessage,
}) {
  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={5}>
          <MyClubOrgChart
            clubId={clubId}
            tenantId={tenantId}
            user={user}
            revision={revision}
            onRefresh={onRevision}
            onMessage={onMessage}
          />
        </Grid>
        <Grid item xs={12} md={7}>
          <MyClubWeeklySchedule
            clubId={clubId}
            tenantId={tenantId}
            user={user}
            revision={revision}
            onRevision={onRevision}
            onMessage={onMessage}
          />
        </Grid>
      </Grid>

      <MyClubSeasonLeagueSection clubId={clubId} tenantId={tenantId} clubRecord={clubRecord} />
    </>
  );
}
