import { Button, Grid, Stack, TextField, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import {
  BatchBError,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
} from "../batchB/ExperienceBatchBFrame.jsx";
import { eventDisplayName } from "../batchB/eventScope.js";
import { ExperienceMatchCard } from "../batchD/ExperienceBatchDSurfaces.jsx";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import {
  individualCourtsPath,
  individualExceptionsPath,
  individualMatchesPath,
  individualOverviewPath,
  individualRefereesPath,
} from "../routes.js";
import { BatchESiblingNav } from "../batchE/BatchENav.jsx";
import { CourtOpsCard, IncidentOpsCard, OpsTimeline } from "../batchE/ExperienceBatchESurfaces.jsx";
import { deriveDirectorModel } from "../batchE/deriveDirector.js";

const TITLE = "Điều hành giải";
const SUBTITLE = "Vận hành đang diễn ra — không phải Tổng quan";
const TEST_ID = "tournament-director-ops-page";

export default function IndividualDirectorOpsPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "all";

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải điều hành…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveDirectorModel(tournament, { selectedEventId });
  const setEvent = (id) => {
    const next = new URLSearchParams(searchParams);
    if (!id || id === "all") next.delete("eventId");
    else next.set("eventId", id);
    setSearchParams(next);
  };

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={[model.tournamentName, model.eventName].filter(Boolean).join(" • ")}
      actions={
        <Stack direction="row" spacing={0.75}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
            Tổng quan
          </Button>
          <span title="Chưa gửi thông báo vận hành từ màn này.">
            <Button variant="outlined" size="small" startIcon={<CampaignOutlinedIcon />} disabled sx={outlinedActionSx}>
              Thông báo nhanh
            </Button>
          </span>
        </Stack>
      }
    >
      <BatchESiblingNav tournamentId={tournamentId} eventId={selectedEventId === "all" ? "" : selectedEventId} current="director" />
      {model.events.length > 1 ? (
        <ExperienceChipRow
          value={selectedEventId}
          onChange={setEvent}
          items={[{ id: "all", label: "Mọi nội dung" }, ...model.events.map((event) => ({ id: event.id, label: eventDisplayName(event) }))]}
        />
      ) : null}
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, md: 3 }}><CenterKpiCard label="Đang thi đấu" value={model.kpis.playing} tone="live" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><CenterKpiCard label="Đang chờ" value={model.kpis.waiting} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><CenterKpiCard label="Trễ" value={model.kpis.late} tone="warning" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><CenterKpiCard label="Hoàn tất" value={model.kpis.completedToday} tone="success" /></Grid>
      </Grid>
      <TournamentExperienceWorkspace
        rail={
          <>
            <CenterRightRailCard title="Cần xử lý" priority={model.issues.length > 0}>
              {model.issues.length ? model.issues.slice(0, 4).map((item) => (
                <IncidentOpsCard
                  key={item.id}
                  item={{
                    id: item.id,
                    title: item.issues[0] || item.id,
                    type: item.issues[0] || "Cần xử lý",
                    severity: "warning",
                    status: "open",
                    match: item.id,
                    court: item.court,
                    owner: "Hồ sơ giải",
                    opened: item.time,
                  }}
                />
              )) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có sự cố trên hồ sơ.</Typography>
              )}
              <Button component={RouterLink} to={individualExceptionsPath(tournamentId, selectedEventId === "all" ? "" : selectedEventId)} size="small" sx={{ mt: 0.5 }}>
                Trung tâm xử lý sự cố
              </Button>
            </CenterRightRailCard>
            <CenterRightRailCard title="Thông báo nhanh">
              <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mb: 0.75 }}>
                Chưa gửi thông báo vận hành từ màn này.
              </Typography>
              <TextField size="small" fullWidth label="Tiêu đề" disabled sx={{ mb: 0.75 }} />
              <span title="Chưa gửi thông báo vận hành từ màn này.">
                <Button size="small" variant="contained" startIcon={<CampaignOutlinedIcon />} disabled>Gửi</Button>
              </span>
            </CenterRightRailCard>
          </>
        }
      >
        <ExperienceSectionTitle>Dải sân</ExperienceSectionTitle>
        {model.courts.length ? (
          <Grid container spacing={1} sx={{ mb: 1.5 }}>
            {model.courts.map((court) => (
              <Grid key={court.id} size={{ xs: 6, sm: 4, md: 3, xl: 2 }}>
                <CourtOpsCard court={court} dense />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1.5 }}>Chưa có sân vật lý trên hồ sơ giải.</Typography>
        )}
        <OpsTimeline items={model.timeline} />
        <ExperienceSectionTitle>Trận đang diễn ra</ExperienceSectionTitle>
        {model.liveMatches.length ? (
          <Stack>
            {model.liveMatches.map((match) => (
              <ExperienceMatchCard key={match.id} match={match} onClick={() => navigate(individualMatchesPath(tournamentId, match.eventId))} />
            ))}
          </Stack>
        ) : (
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có trận đang thi đấu trên hồ sơ.</Typography>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap" }}>
          <Button component={RouterLink} to={individualCourtsPath(tournamentId, selectedEventId === "all" ? "" : selectedEventId)} size="small">Bảng điều hành sân</Button>
          <Button component={RouterLink} to={individualRefereesPath(tournamentId, selectedEventId === "all" ? "" : selectedEventId)} size="small">Bảng trọng tài</Button>
          <Button component={RouterLink} to={individualExceptionsPath(tournamentId, selectedEventId === "all" ? "" : selectedEventId)} size="small">Trung tâm xử lý sự cố</Button>
          <span title="Chưa hỗ trợ thao tác này trong nội dung hiện tại.">
            <Button size="small" disabled>Xử lý chậm</Button>
          </span>
          <span title="Chưa hỗ trợ thao tác này trong nội dung hiện tại.">
            <Button size="small" disabled>Chuyển sân</Button>
          </span>
          <span title="Chưa hỗ trợ thao tác này trong nội dung hiện tại.">
            <Button size="small" disabled>Tạm dừng</Button>
          </span>
        </Stack>
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
