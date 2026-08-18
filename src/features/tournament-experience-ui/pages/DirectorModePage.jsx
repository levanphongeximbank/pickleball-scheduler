import { Button, Grid, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";

import TournamentExperienceShell from "../components/TournamentExperienceShell.jsx";
import TournamentKpiCard from "../components/TournamentKpiCard.jsx";
import TournamentRightRailCard from "../components/TournamentRightRailCard.jsx";
import TournamentSectionTitle from "../components/TournamentSectionTitle.jsx";
import TournamentWorkspace from "../components/TournamentWorkspace.jsx";
import { CourtOpsCard, IncidentOpsCard, OpsTimeline } from "../components/liveOpsSurfaces.jsx";
import { MatchCard } from "../components/prototypeCards.jsx";
import { FIXTURE_COURTS, FIXTURE_INCIDENTS, FIXTURE_MATCH_REGISTRY, FIXTURE_OPS, FIXTURE_OPS_TIMELINE } from "../fixtures/opsFixture.js";
import { FIXTURE_TOURNAMENT_ID } from "../fixtures/prototypeFixture.js";
import { tournamentPath } from "../navigation/tournamentNav.js";

export default function DirectorModePage() {
  const openIncidents = FIXTURE_INCIDENTS.filter((item) => item.status === "open" || item.status === "watching");

  return (
    <TournamentExperienceShell
      title="Điều hành giải"
      subtitle="Vận hành đang diễn ra — không phải Tổng quan"
      showEventContext
      actions={
        <Button variant="outlined" size="small" startIcon={<CampaignOutlinedIcon />}>
          Thông báo nhanh
        </Button>
      }
    >
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, md: 3 }}><TournamentKpiCard label="Đang thi đấu" value={FIXTURE_OPS.playing} tone="live" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TournamentKpiCard label="Đang chờ" value={FIXTURE_OPS.waiting} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TournamentKpiCard label="Trễ" value={FIXTURE_OPS.late} tone="warning" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TournamentKpiCard label="Hoàn tất" value={FIXTURE_OPS.completedToday} tone="success" /></Grid>
      </Grid>
      <TournamentWorkspace
        rail={
          <>
            <TournamentRightRailCard title="Cần xử lý" priority>
              {openIncidents.slice(0, 4).map((item) => (
                <IncidentOpsCard key={item.id} item={item} />
              ))}
              <Button component={RouterLink} to={tournamentPath(FIXTURE_TOURNAMENT_ID, "exceptions")} size="small" sx={{ mt: 0.5 }}>
                Trung tâm xử lý sự cố
              </Button>
            </TournamentRightRailCard>
            <TournamentRightRailCard title="Thông báo nhanh">
              <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.75 }}>
                Phụ trợ vận hành đang diễn ra. Chỉ dữ liệu mẫu.
              </Typography>
              <TextField size="small" fullWidth label="Tiêu đề" defaultValue="Nhắc trận đang thi đấu" sx={{ mb: 0.75 }} />
              <Button size="small" variant="contained" startIcon={<CampaignOutlinedIcon />}>Gửi (dữ liệu mẫu)</Button>
            </TournamentRightRailCard>
          </>
        }
      >
        <TournamentSectionTitle>Dải sân</TournamentSectionTitle>
        <Grid container spacing={1} sx={{ mb: 1.5 }}>
          {FIXTURE_COURTS.map((court) => (
            <Grid key={court.id} size={{ xs: 6, sm: 4, md: 3, xl: 2 }}>
              <CourtOpsCard court={court} dense />
            </Grid>
          ))}
        </Grid>
        <OpsTimeline items={FIXTURE_OPS_TIMELINE} />
        <TournamentSectionTitle>Trận đang diễn ra</TournamentSectionTitle>
        <Stack>
          {FIXTURE_MATCH_REGISTRY.filter((row) => row.status === "live").map((match) => (
            <MatchCard key={match.id} match={match} to={tournamentPath(FIXTURE_TOURNAMENT_ID, "matches")} />
          ))}
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap" }}>
          <Button component={RouterLink} to={tournamentPath(FIXTURE_TOURNAMENT_ID, "courts")} size="small">Bảng điều hành sân</Button>
          <Button component={RouterLink} to={tournamentPath(FIXTURE_TOURNAMENT_ID, "referees")} size="small">Bảng trọng tài</Button>
          <Button component={RouterLink} to={tournamentPath(FIXTURE_TOURNAMENT_ID, "exceptions")} size="small">Trung tâm xử lý sự cố</Button>
        </Stack>
      </TournamentWorkspace>
    </TournamentExperienceShell>
  );
}
