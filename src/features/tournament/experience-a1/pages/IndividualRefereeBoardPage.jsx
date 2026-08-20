import { Button, Grid, Typography } from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

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
import { CompetitionContextHeader, StageSelector } from "../batchD/ExperienceBatchDSurfaces.jsx";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { individualOverviewPath } from "../routes.js";
import { BatchESiblingNav } from "../batchE/BatchENav.jsx";
import { RefereeOpsCard } from "../batchE/ExperienceBatchESurfaces.jsx";
import { deriveRefereeBoardModel } from "../batchE/deriveRefereeBoard.js";
import { OPS_STATUS, opsStatusLabelVi } from "../batchE/opsStatus.js";

const TITLE = "Bảng trọng tài";
const SUBTITLE = "Bảng phân công BTC — không phải bảng điểm";
const TEST_ID = "tournament-referee-board-page";

export default function IndividualRefereeBoardPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "all";
  const status = searchParams.get("status") || "all";
  const court = searchParams.get("court") || "all";
  const stage = searchParams.get("stage") || "all";

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải bảng trọng tài…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveRefereeBoardModel(tournament, { selectedEventId, status, court, stage });
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={[model.tournamentName, model.eventName].filter(Boolean).join(" • ")}
      actions={
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
          Tổng quan
        </Button>
      }
    >
      <BatchESiblingNav tournamentId={tournamentId} eventId={selectedEventId === "all" ? "" : selectedEventId} current="referees" />
      <CompetitionContextHeader tournament={model.tournamentName} event={model.eventName} stage="Vận hành đang diễn ra" />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đang thi đấu" value={model.kpis.live} tone="live" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Sẵn sàng" value={model.kpis.available} tone="success" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Tiếp theo" value={model.kpis.next} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Chưa gán" value={model.kpis.unassigned} tone="warning" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Cần xử lý" value={model.kpis.attention} tone="warning" /></Grid>
      </Grid>
      <ExperienceChipRow
        value={status}
        onChange={(id) => setParam("status", id)}
        items={[
          { id: "all", label: "Mọi trạng thái" },
          { id: OPS_STATUS.LIVE, label: opsStatusLabelVi(OPS_STATUS.LIVE) },
          { id: OPS_STATUS.NEXT, label: opsStatusLabelVi(OPS_STATUS.NEXT) },
          { id: OPS_STATUS.ATTENTION, label: opsStatusLabelVi(OPS_STATUS.ATTENTION) },
          { id: "none", label: "Chưa có lịch" },
        ]}
      />
      <ExperienceChipRow
        value={court}
        onChange={(id) => setParam("court", id)}
        items={[{ id: "all", label: "Mọi sân" }, ...model.courts.map((item) => ({ id: item.name, label: item.name }))]}
      />
      {model.events.length > 1 ? (
        <ExperienceChipRow
          value={selectedEventId}
          onChange={(id) => setParam("eventId", id)}
          items={[{ id: "all", label: "Mọi nội dung" }, ...model.events.map((event) => ({ id: event.id, label: eventDisplayName(event) }))]}
        />
      ) : null}
      <StageSelector
        value={stage}
        onChange={(id) => setParam("stage", id)}
        items={[{ id: "all", label: "Mọi vòng" }, ...model.stages.map((item) => ({ id: item, label: item }))]}
      />
      <TournamentExperienceWorkspace
        rail={
          <>
            <CenterRightRailCard title="Trận chưa có trọng tài" priority={model.unassigned.length > 0}>
              {model.unassigned.length ? model.unassigned.map((match) => (
                <Typography key={match.id} sx={{ fontSize: 12.5, mb: 0.5 }}>
                  {match.id} • {match.court} • {match.time}
                </Typography>
              )) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có trận thiếu trọng tài trên hồ sơ.</Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Xung đột phân công">
              {model.allReferees.filter((item) => item.issue).length ? model.allReferees.filter((item) => item.issue).map((item) => (
                <Typography key={item.id} sx={{ fontSize: 12.5 }}>{item.name}: {item.issue}</Typography>
              )) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có xung đột phân công trên hồ sơ.</Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Trọng tài sẵn sàng">
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                Chưa có lịch sẵn sàng riêng trên hồ sơ. Không mặc định gắn nhãn sẵn sàng.
              </Typography>
            </CenterRightRailCard>
            <CenterRightRailCard title="Cần xử lý">
              {model.allReferees.filter((item) => item.issue).length ? model.allReferees.filter((item) => item.issue).map((item) => (
                <Typography key={item.id} sx={{ fontSize: 12.5 }}>{item.name}: {item.issue}</Typography>
              )) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có mục cần xử lý.</Typography>
              )}
            </CenterRightRailCard>
          </>
        }
      >
        <ExperienceSectionTitle>Bảng phân công trọng tài</ExperienceSectionTitle>
        {model.referees.length ? (
          <Grid container spacing={1.25}>
            {model.referees.map((referee) => (
              <Grid key={referee.id} size={{ xs: 12, sm: 6 }}>
                <RefereeOpsCard referee={referee} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có trọng tài trên hồ sơ giải.</Typography>
        )}
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
