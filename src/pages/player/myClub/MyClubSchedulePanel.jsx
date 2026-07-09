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
      <MyClubOrgChart
        clubId={clubId}
        tenantId={tenantId}
        user={user}
        revision={revision}
        onRefresh={onRevision}
        onMessage={onMessage}
      />
      <MyClubWeeklySchedule
        clubId={clubId}
        tenantId={tenantId}
        user={user}
        revision={revision}
        onRevision={onRevision}
        onMessage={onMessage}
      />
      <MyClubSeasonLeagueSection clubId={clubId} tenantId={tenantId} clubRecord={clubRecord} />
    </>
  );
}
