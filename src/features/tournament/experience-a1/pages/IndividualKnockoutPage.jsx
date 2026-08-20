import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Button, Grid, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import TournamentExperienceWorkspace from "../components/TournamentExperienceWorkspace.jsx";
import {
  BatchBError,
  BatchBEventPicker,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
} from "../batchB/ExperienceBatchBFrame.jsx";
import { BatchDSiblingNav } from "../batchD/BatchDNav.jsx";
import { deriveKnockoutModel } from "../batchD/deriveKnockout.js";
import {
  CompetitionContextHeader,
  CompetitionProgress,
  ExperienceMatchCard,
  KnockoutProgressionDiagram,
  StageSelector,
} from "../batchD/ExperienceBatchDSurfaces.jsx";
import CenterKpiCard from "../visual/CenterKpiCard.jsx";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceReadinessPanel from "../visual/ExperienceReadinessPanel.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR } from "../visual/tournamentExperienceTokens.js";
import { individualBracketPath, individualOverviewPath } from "../routes.js";

const TITLE = "Vòng loại trực tiếp";
const SUBTITLE = "Xem theo vòng — không phải sơ đồ nhánh đấu";
const TEST_ID = "tournament-knockout-page";

export default function IndividualKnockoutPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "";
  const round = searchParams.get("round") || "";

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải vòng loại…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveKnockoutModel(tournament, { selectedEventId, round });
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <ExperienceBatchBFrame
      testId={TEST_ID}
      title={TITLE}
      subtitle={SUBTITLE}
      contextLine={[model.tournamentName, model.eventName].filter(Boolean).join(" • ")}
      actions={
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(individualOverviewPath(tournamentId))} sx={outlinedActionSx}>
            Tổng quan
          </Button>
          <Button component={RouterLink} to={individualBracketPath(tournamentId, model.eventId)} size="small" variant="outlined" sx={outlinedActionSx}>
            Sơ đồ nhánh đấu
          </Button>
        </Stack>
      }
    >
      <BatchDSiblingNav tournamentId={tournamentId} eventId={model.eventId} current="knockout" />
      <BatchBEventPicker events={model.events} selectedEventId={selectedEventId} onSelect={(id) => setParam("eventId", id)} />
      {model.emptyEvents ? <Alert severity="info" sx={{ mb: 1.25 }}>Chưa có nội dung trên hồ sơ.</Alert> : null}
      {model.needsEventChoice ? <Alert severity="info" sx={{ mb: 1.25 }}>Chọn nội dung để xem loại trực tiếp.</Alert> : null}
      <CompetitionContextHeader
        tournament={model.tournamentName}
        event={model.eventName}
        stage={`Loại trực tiếp • ${model.rounds.find((item) => item.id === model.selectedRound)?.label || "Chưa có vòng"}`}
      />
      {model.rounds.length ? (
        <StageSelector value={model.selectedRound} onChange={(id) => setParam("round", id)} items={model.rounds} />
      ) : (
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>Chưa có vòng loại trực tiếp trên hồ sơ.</Typography>
      )}
      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Tổng trận" value={model.kpis.total} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Hoàn tất" value={model.kpis.completed} tone="success" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Đang thi đấu" value={model.kpis.live} tone="live" /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Sắp tới" value={model.kpis.upcoming} /></Grid>
        <Grid size={{ xs: 6, sm: true }}><CenterKpiCard label="Cần xử lý" value={model.kpis.attention} tone="warning" /></Grid>
      </Grid>
      <CompetitionProgress current={model.kpis.completed} total={model.kpis.total} label={`Tiến độ ${model.rounds.find((item) => item.id === model.selectedRound)?.label || "vòng"}`} remainingLabel="Còn {n}" />
      <TournamentExperienceWorkspace
        rail={
          <>
            <CenterRightRailCard title="Tiến độ vòng">
              <Typography sx={{ fontSize: 12.5 }}>{model.kpis.completed}/{model.kpis.total} trận hoàn tất</Typography>
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Đang thi đấu {model.kpis.live} • Sắp tới {model.kpis.upcoming}</Typography>
            </CenterRightRailCard>
            <CenterRightRailCard title="Tiến vào vòng sau">
              {model.hasBracket && model.progressionForks.length ? (
                <>
                  <KnockoutProgressionDiagram forks={model.progressionForks} />
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 1 }}>
                    Thắng {model.selectedRound || "—"} → vào {model.nextRoundLabel}.
                  </Typography>
                </>
              ) : (
                <Typography
                  data-testid="knockout-progression-empty"
                  sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}
                >
                  Chưa có cấu trúc vòng loại trực tiếp trên hồ sơ.
                </Typography>
              )}
            </CenterRightRailCard>
            <CenterRightRailCard title="Cần xử lý" priority={model.kpis.attention > 0}>
              {model.kpis.attention ? model.matches.filter((m) => m.status === "attention").map((m) => (
                <Typography key={m.id} sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.warning }}>{m.id} • {m.court}</Typography>
              )) : (
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.success }}>Không có trận cần xử lý</Typography>
              )}
            </CenterRightRailCard>
            <ExperienceReadinessPanel
              title="Mức sẵn sàng vòng tiếp"
              statusLabel={model.roundReady ? "SẴN SÀNG" : `CHƯA SẴN SÀNG • ${model.kpis.live + model.kpis.upcoming + model.kpis.attention}`}
              statusTone={model.roundReady ? "success" : "warning"}
              items={[
                { label: "Vòng hiện tại hoàn tất", ready: model.kpis.total > 0 && model.kpis.completed === model.kpis.total, note: `${model.kpis.completed}/${model.kpis.total}` },
                { label: "Không trận đang thi đấu / cần xử lý", ready: model.kpis.live === 0 && model.kpis.attention === 0 },
                { label: `Sẵn sàng cho ${model.nextRoundLabel}`, ready: model.roundReady, note: model.roundReady ? "Có thể chuyển" : "Chưa đủ" },
              ]}
            />
          </>
        }
      >
        <ExperienceSectionTitle>Tất cả trận {model.selectedRound || ""}</ExperienceSectionTitle>
        {model.matches.map((match) => (
          <ExperienceMatchCard key={match.id} match={match} />
        ))}
      </TournamentExperienceWorkspace>
    </ExperienceBatchBFrame>
  );
}
