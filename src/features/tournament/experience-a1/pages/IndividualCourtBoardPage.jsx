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
import { CourtOpsCard } from "../batchE/ExperienceBatchESurfaces.jsx";
import { deriveCourtBoardModel } from "../batchE/deriveCourtBoard.js";
import { OPS_STATUS, opsStatusLabelVi } from "../batchE/opsStatus.js";

const TITLE = "Bảng điều hành sân";
const SUBTITLE = "Sân vật lý — không phải công cụ sân CLB";
const TEST_ID = "tournament-court-board-page";

export default function IndividualCourtBoardPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "all";
  const stage = searchParams.get("stage") || "all";
  const status = searchParams.get("status") || "all";

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải bảng sân…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveCourtBoardModel(tournament, { selectedEventId, stage, status });
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
      <BatchESiblingNav tournamentId={tournamentId} eventId={selectedEventId === "all" ? "" : selectedEventId} current="courts" />
      <CompetitionContextHeader
        tournament={model.tournamentName}
        event={model.clusterHint}
        extra={`${model.physicalCourtCount} sân vật lý`}
      />
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đang thi đấu" value={model.kpis.live} tone="live" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Tiếp theo" value={model.kpis.next} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Sẵn sàng" value={model.kpis.available} tone="success" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Chậm" value={model.kpis.delay} tone="warning" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Bảo trì" value={model.kpis.maintenance} tone="danger" /></Grid>
      </Grid>
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
      <ExperienceChipRow
        value={status}
        onChange={(id) => setParam("status", id)}
        items={[
          { id: "all", label: "Mọi trạng thái" },
          { id: OPS_STATUS.LIVE, label: opsStatusLabelVi(OPS_STATUS.LIVE) },
          { id: OPS_STATUS.NEXT, label: opsStatusLabelVi(OPS_STATUS.NEXT) },
          { id: OPS_STATUS.AVAILABLE, label: opsStatusLabelVi(OPS_STATUS.AVAILABLE) },
          { id: OPS_STATUS.DELAY, label: opsStatusLabelVi(OPS_STATUS.DELAY) },
          { id: OPS_STATUS.MAINTENANCE, label: opsStatusLabelVi(OPS_STATUS.MAINTENANCE) },
        ]}
      />
      <TournamentExperienceWorkspace
        rail={
          <>
            <CenterRightRailCard title="Hàng chờ">
              {model.waitingQueue.length ? model.waitingQueue.map((item) => (
                <Typography key={item.id} sx={{ fontSize: 12.5, mb: 0.5 }}>
                  {item.id} • {item.court} • {item.time}
                </Typography>
              )) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có trận đang chờ trên hồ sơ.</Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Trận bị chậm">
              {model.delayed.length ? model.delayed.map((court) => (
                <Typography key={court.id} sx={{ fontSize: 12.5 }}>
                  {court.name} • {court.currentMatch?.id || "—"}
                </Typography>
              )) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có sân chậm trên hồ sơ.</Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Bảo trì">
              {model.maintenance.length ? model.maintenance.map((court) => (
                <Typography key={court.id} sx={{ fontSize: 12.5 }}>{court.name}</Typography>
              )) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có sân bảo trì trên hồ sơ.</Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Mức sử dụng sân">
              <Typography sx={{ fontSize: 12.5 }}>{model.kpis.live} đang thi đấu / {model.physicalCourtCount}</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{model.kpis.available} sẵn sàng</Typography>
              <Typography sx={{ fontSize: 12.5 }}>{model.kpis.next} tiếp theo</Typography>
            </CenterRightRailCard>
          </>
        }
      >
        <ExperienceSectionTitle>{model.physicalCourtCount} sân vật lý</ExperienceSectionTitle>
        {model.courts.length ? (
          <Grid container spacing={1.25}>
            {model.courts.map((court) => (
              <Grid key={court.id} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                <CourtOpsCard court={court} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có sân vật lý trên hồ sơ giải.</Typography>
        )}
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
