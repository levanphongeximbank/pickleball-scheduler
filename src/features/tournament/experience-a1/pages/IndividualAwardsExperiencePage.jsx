import { Box, Button, Grid, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { individualPublicTournamentPath } from "../../../../config/tournamentRoutes.js";
import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import {
  BatchBError,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
} from "../batchB/ExperienceBatchBFrame.jsx";
import { eventDisplayName } from "../batchB/eventScope.js";
import CenterRightRailCard from "../visual/CenterRightRailCard.jsx";
import ExperienceChipRow from "../visual/ExperienceChipRow.jsx";
import ExperienceSectionTitle from "../visual/ExperienceSectionTitle.jsx";
import { outlinedActionSx, TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../visual/tournamentExperienceTokens.js";
import { individualOverviewPath } from "../routes.js";
import { BatchFNav } from "../batchF/BatchFNav.jsx";
import {
  AwardCard,
  LifecycleStepper,
  PresentationStatusChip,
  ReadinessPanel,
} from "../batchF/ExperienceBatchFSurfaces.jsx";
import { deriveAwardsModel } from "../batchF/deriveAwards.js";

const TITLE = "Kết quả chung cuộc & Giải thưởng";
const SUBTITLE = "Không phải màn BXH • Không phải Hoàn tất giải đấu";
const TEST_ID = "tournament-awards-page";

export default function IndividualAwardsExperiencePage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "";

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải giải thưởng…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveAwardsModel(tournament, { selectedEventId });
  const setEvent = (id) => {
    const next = new URLSearchParams(searchParams);
    if (!id) next.delete("eventId");
    else next.set("eventId", id);
    setSearchParams(next);
  };
  const champion = model.podium.find((item) => item.rank === 1);
  const others = model.podium.filter((item) => item.rank !== 1);
  const finalResultReady = model.officialResult && Boolean(champion?.pair && champion.pair !== "Chưa xác định");

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
          <span title="Chưa hỗ trợ ghi giải thưởng trên màn này.">
            <Button variant="outlined" size="small" disabled>
              Xác nhận kết quả cuối
            </Button>
          </span>
          <span title="Chưa hỗ trợ ghi giải thưởng trên màn này.">
            <Button variant="contained" size="small" disabled>
              Công bố giải thưởng
            </Button>
          </span>
          <Button variant="outlined" size="small" component={RouterLink} to={individualPublicTournamentPath(tournamentId)}>
            Xem trước trang công khai
          </Button>
        </Stack>
      }
    >
      <BatchFNav tournamentId={tournamentId} eventId={selectedEventId} current="awards" />
      <LifecycleStepper current={finalResultReady ? "Giải thưởng" : "Kết quả cuối"} />
      {model.needsEventChoice ? (
        <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>
          Chọn nội dung để xem bục trao giải.
        </Typography>
      ) : null}
      {model.events.length > 1 ? (
        <ExperienceChipRow
          value={selectedEventId || model.eventId}
          onChange={setEvent}
          items={model.events.map((event) => ({ id: event.id, label: eventDisplayName(event) }))}
        />
      ) : null}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 300px" },
          gridTemplateAreas: {
            xs: `"podium" "awards" "rail"`,
            lg: `"podium rail" "awards rail"`,
          },
        }}
      >
        <Box sx={{ gridArea: "podium", minWidth: 0 }}>
          <ExperienceSectionTitle action={<PresentationStatusChip status={finalResultReady ? "CONFIRMED" : "NOT_READY"} />}>
            Bục trao giải — {model.eventName}
          </ExperienceSectionTitle>
          {!model.podium.length ? (
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có kết quả chung cuộc trên hồ sơ.</Typography>
          ) : (
            <Grid container spacing={1.25}>
              {champion ? (
                <Grid size={{ xs: 12 }}>
                  <AwardCard featured rank={1} title={champion.place} pair={champion.pair} event={model.eventName} status={champion.status} />
                </Grid>
              ) : null}
              {others.map((item) => (
                <Grid key={item.rank} size={{ xs: 12, sm: 6 }}>
                  <AwardCard rank={item.rank} title={item.place} pair={item.pair} event={model.eventName} status={item.status} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
        <Box sx={{ gridArea: "awards", minWidth: 0 }}>
          <ExperienceSectionTitle>Giải phụ</ExperienceSectionTitle>
          {!model.specialAwards.length ? (
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa gán giải phụ trên hồ sơ.</Typography>
          ) : (
            <Grid container spacing={1.25}>
              {model.specialAwards.map((item) => (
                <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <AwardCard
                    title={item.place}
                    pair={item.pair}
                    event={model.eventName}
                    status={model.publicationReady && item.assigned ? "ASSIGNED" : "NOT_READY"}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
        <Box sx={{ gridArea: "rail", minWidth: 0 }}>
          <ReadinessPanel
            title="Mức sẵn sàng công bố giải thưởng"
            statusLabel={model.publicationReady ? "SẴN SÀNG" : "CHƯA SẴN SÀNG"}
            items={model.readinessItems}
          />
          <Box sx={{ mt: 1.25 }}>
            <CenterRightRailCard title="Xem trước trang công khai">
              <Paper
                elevation={0}
                sx={{
                  p: 1.25,
                  borderRadius: `${TOURNAMENT_RADIUS.card}px`,
                  border: `1px solid ${TOURNAMENT_COLOR.divider}`,
                  bgcolor: TOURNAMENT_COLOR.cardBg,
                }}
              >
                <Typography sx={{ fontWeight: 800 }}>{model.tournamentName}</Typography>
                <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
                  {champion?.pair || "Chưa có vô địch công bố"}
                </Typography>
              </Paper>
            </CenterRightRailCard>
          </Box>
        </Box>
      </Box>
    </ExperienceBatchBFrame>
  );
}
