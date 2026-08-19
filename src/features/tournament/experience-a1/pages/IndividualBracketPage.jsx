import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Button, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import {
  BatchBError,
  BatchBEventPicker,
  BatchBLoading,
  BatchBMissingTournament,
  BatchBWrongFamily,
  ExperienceBatchBFrame,
} from "../batchB/ExperienceBatchBFrame.jsx";
import { BatchDSiblingNav } from "../batchD/BatchDNav.jsx";
import { deriveBracketModel } from "../batchD/deriveKnockout.js";
import {
  BracketColumn,
  BracketMatchNode,
  CompetitionContextHeader,
  StageSelector,
} from "../batchD/ExperienceBatchDSurfaces.jsx";
import { displayBracketRoundLabel } from "../batchD/labels.js";
import { outlinedActionSx, TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../visual/tournamentExperienceTokens.js";
import { individualOverviewPath } from "../routes.js";

const TITLE = "Sơ đồ nhánh đấu";
const SUBTITLE = "Thắng X → vào Y. Trang không tràn ngang.";
const TEST_ID = "tournament-bracket-page";

export default function IndividualBracketPage() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { activeClub, revision } = useClub();
  const { tournament, loading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const selectedEventId = searchParams.get("eventId") || "";
  const round = searchParams.get("round") || "";

  if (loading) return <BatchBLoading testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} message="Đang tải sơ đồ nhánh…" />;
  if (error) return <BatchBError testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} error={error} />;
  if (!tournament) return <BatchBMissingTournament testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;
  if (!isIndividualTournament(tournament)) return <BatchBWrongFamily testId={TEST_ID} title={TITLE} subtitle={SUBTITLE} />;

  const model = deriveBracketModel(tournament, { selectedEventId, round });
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };
  const currentMatches = model.columns.find((column) => column.id === model.selectedRound)?.matches || [];
  const nextMatches =
    model.nextRound === "Champion" && model.champion
      ? [model.champion]
      : model.columns.find((column) => column.id === model.nextRound)?.matches || [];

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
      <BatchDSiblingNav tournamentId={tournamentId} eventId={model.eventId} current="bracket" />
      <BatchBEventPicker events={model.events} selectedEventId={selectedEventId} onSelect={(id) => setParam("eventId", id)} />
      {model.emptyEvents ? <Alert severity="info" sx={{ mb: 1.25 }}>Chưa có nội dung trên hồ sơ.</Alert> : null}
      {model.needsEventChoice ? <Alert severity="info" sx={{ mb: 1.25 }}>Chọn nội dung để xem sơ đồ nhánh.</Alert> : null}
      <CompetitionContextHeader tournament={model.tournamentName} event={model.eventName} stage="Vòng loại trực tiếp • Sơ đồ nhánh đấu" />
      {isMobile ? (
        <>
          <StageSelector
            value={model.selectedRound || "Champion"}
            onChange={(id) => setParam("round", id)}
            items={model.roundItems}
          />
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }} data-testid="bracket-mobile-nav">
            Điều hướng theo vòng. Thắng {displayBracketRoundLabel(model.selectedRound)} → {displayBracketRoundLabel(model.nextRound || "Champion")}.
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              overflowX: "auto",
              maxWidth: "100%",
              pb: 1,
              scrollSnapType: "x mandatory",
            }}
          >
            <Box sx={{ minWidth: "86%", scrollSnapAlign: "start" }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>{displayBracketRoundLabel(model.selectedRound)}</Typography>
              <Stack spacing={1}>
                {currentMatches.map((match) => (
                  <BracketMatchNode key={match.id} match={match} />
                ))}
              </Stack>
            </Box>
            <Box sx={{ minWidth: "70%", scrollSnapAlign: "start" }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>{displayBracketRoundLabel(model.nextRound || "Champion")}</Typography>
              <Stack spacing={1}>
                {nextMatches.map((match) => (
                  <BracketMatchNode key={match.id} match={match} champion={model.nextRound === "Champion" || match.id === "champion"} />
                ))}
              </Stack>
            </Box>
          </Box>
        </>
      ) : (
        <Box
          sx={{
            overflowX: "auto",
            maxWidth: "100%",
            pb: 1,
            border: `1px solid ${TOURNAMENT_COLOR.divider}`,
            borderRadius: `${TOURNAMENT_RADIUS.card}px`,
            bgcolor: TOURNAMENT_COLOR.pageBg,
          }}
        >
          <Box sx={{ display: "flex", gap: 0.5, p: 1.5, minWidth: 1180, alignItems: "stretch" }}>
            {model.columns.map((column, index) => (
              <BracketColumn
                key={column.id}
                title={column.title}
                matches={column.matches}
                showConnectors={index < model.columns.length - 1 || Boolean(model.champion)}
              />
            ))}
            {model.champion ? <BracketColumn title="Champion" matches={[model.champion]} showConnectors={false} /> : null}
          </Box>
        </Box>
      )}
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted, mt: 1 }}>
        Đang thi đấu = đỏ • Hoàn tất = xanh • Sắp tới = trung tính • Ô vô địch tách biệt.
      </Typography>
    </ExperienceBatchBFrame>
  );
}
