import { useState } from "react";
import {
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";

import { useClub } from "../../../../context/ClubContext.jsx";
import { isIndividualTournament } from "../../../../config/tournamentRoutes.js";
import { useCanonicalTournament } from "../../hooks/useCanonicalTournament.js";
import ExperienceOperatorCard from "../visual/ExperienceOperatorCard.jsx";
import ExperienceStatusChip from "../visual/ExperienceStatusChip.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_RADIUS } from "../visual/tournamentExperienceTokens.js";
import { matchStatusLabel, matchStatusTone } from "../batchD/labels.js";
import { derivePublicExperienceModel } from "../batchF/derivePublicExperience.js";

const TEST_ID = "public-tournament-page";

const TABS = [
  { id: "overview", label: "Tổng quan" },
  { id: "schedule", label: "Lịch thi đấu" },
  { id: "live", label: "Trực tiếp" },
  { id: "standings", label: "Bảng xếp hạng" },
  { id: "bracket", label: "Nhánh đấu" },
  { id: "results", label: "Kết quả" },
  { id: "media", label: "Truyền thông" },
];

function PublicMatchRow({ match }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        mb: 1,
        border: `1px solid ${TOURNAMENT_COLOR.divider}`,
        bgcolor: TOURNAMENT_COLOR.cardBg,
        borderRadius: `${TOURNAMENT_RADIUS.card}px`,
      }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.4 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
          {[match.event, match.stage].filter(Boolean).join(" • ")}
        </Typography>
        <ExperienceStatusChip tone={matchStatusTone(match.status)} label={matchStatusLabel(match.status)} />
      </Stack>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{match.a} vs {match.b}</Typography>
      <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
        {[match.time, match.court, match.score].filter(Boolean).join(" • ")}
      </Typography>
    </Paper>
  );
}

export default function IndividualPublicExperiencePage() {
  const { tournamentId } = useParams();
  const { activeClub, revision, clubScopeReady } = useClub();
  const { tournament, loading: tournamentLoading, error } = useCanonicalTournament(activeClub, tournamentId, revision);
  const [tab, setTab] = useState("overview");

  if (!tournamentId) {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: TOURNAMENT_COLOR.pageBg, p: 3 }} data-testid={TEST_ID}>
        <Typography sx={{ fontWeight: 700 }}>Không tìm thấy trang công khai giải đấu.</Typography>
      </Box>
    );
  }

  if (!clubScopeReady || tournamentLoading) {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: TOURNAMENT_COLOR.pageBg, p: 3 }} data-testid={TEST_ID}>
        <Typography>Đang tải trang công khai…</Typography>
      </Box>
    );
  }

  if (error || !tournament || !isIndividualTournament(tournament)) {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: TOURNAMENT_COLOR.pageBg, p: 3 }} data-testid={TEST_ID}>
        <Typography sx={{ fontWeight: 700 }}>Không tìm thấy trang công khai giải đấu.</Typography>
      </Box>
    );
  }

  const model = derivePublicExperienceModel(tournament);
  const cta = model.registration;

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: TOURNAMENT_COLOR.pageBg, overflowX: "hidden" }} data-testid={TEST_ID}>
      <Box data-testid="public-site-header" sx={{ px: 2, py: 1.1, bgcolor: TOURNAMENT_COLOR.navy, color: "#FFF" }}>
        <Typography sx={{ fontWeight: 800, letterSpacing: 0.4 }}>PICK_VN</Typography>
        <Typography sx={{ fontSize: 12, opacity: 0.75 }}>Trang giải đấu công khai</Typography>
      </Box>
      <Container maxWidth="lg" sx={{ py: 2, px: { xs: 1.5, md: 2 } }}>
        <Box
          sx={{
            borderRadius: `${TOURNAMENT_RADIUS.card}px`,
            overflow: "hidden",
            mb: 1.5,
            boxShadow: "0 10px 28px rgba(15, 27, 45, 0.22)",
            background: `linear-gradient(120deg, ${TOURNAMENT_COLOR.navy} 0%, #16325C 42%, ${TOURNAMENT_COLOR.primary} 100%)`,
            color: "#FFF",
          }}
        >
          <Box sx={{ px: { xs: 1.75, md: 2.25 }, py: { xs: 1.5, md: 2 } }}>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 0.7, flexWrap: "wrap" }}>
              <ExperienceStatusChip tone="info" label={model.statusLabel} />
              {model.schedulePublished ? <ExperienceStatusChip tone="success" label="Lịch công bố" /> : null}
            </Stack>
            <Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 800, lineHeight: 1.1 }}>{model.tournamentName}</Typography>
            <Typography sx={{ fontSize: 13, mt: 0.75, opacity: 0.92 }}>
              {model.dates} • {model.location}
            </Typography>
            <Button
              variant="contained"
              size="small"
              disabled={cta.disabled}
              data-testid="public-registration-cta"
              sx={{ mt: 1.25, ...(cta.disabled ? { bgcolor: TOURNAMENT_COLOR.disabled } : {}) }}
            >
              {cta.label}
            </Button>
          </Box>
        </Box>
        <Tabs
          value={tab}
          onChange={(_e, value) => setTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 2, minHeight: 36, "& .MuiTab-root": { textTransform: "none", minHeight: 36 } }}
        >
          {TABS.map((item) => (
            <Tab key={item.id} value={item.id} label={item.label} />
          ))}
        </Tabs>
        {tab === "overview" ? (
          <>
            <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
              {model.eventCards.map((event) => (
                <Grid key={event.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <ExperienceOperatorCard>
                    <Typography sx={{ fontWeight: 700 }}>{event.name}</Typography>
                    <Typography sx={{ fontSize: 12 }}>{event.pairs} cặp • {event.stage}</Typography>
                  </ExperienceOperatorCard>
                </Grid>
              ))}
            </Grid>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Trận đang diễn ra</Typography>
            {model.liveMatches.length ? model.liveMatches.map((match) => <PublicMatchRow key={match.id} match={match} />) : (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted, mb: 1 }}>Không có trận live công khai.</Typography>
            )}
            <Typography sx={{ fontWeight: 700, mt: 1.5, mb: 1 }}>Lịch sắp tới</Typography>
            {model.schedulePreview.length ? model.schedulePreview.slice(0, 3).map((match) => (
              <PublicMatchRow key={`sched-${match.id}`} match={match} />
            )) : (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có lịch công khai.</Typography>
            )}
          </>
        ) : null}
        {tab === "schedule" ? (
          model.schedulePreview.length ? model.schedulePreview.map((match) => <PublicMatchRow key={match.id} match={match} />) : (
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có lịch công khai.</Typography>
          )
        ) : null}
        {tab === "live" ? (
          model.liveMatches.length ? model.liveMatches.map((match) => <PublicMatchRow key={match.id} match={match} />) : (
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Không có trận trực tiếp.</Typography>
          )
        ) : null}
        {tab === "standings" || tab === "results" ? (
          <Stack spacing={0.75}>
            {(tab === "standings" ? model.standingsPreview : model.resultsPreview).length ? (
              (tab === "standings" ? model.standingsPreview : model.resultsPreview).map((row) => (
                <ExperienceOperatorCard key={row.id}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {row.rank ? `${row.rank}. ` : ""}{row.pair}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: TOURNAMENT_COLOR.textMuted }}>
                    {[row.qual, row.event, row.points != null ? `${row.points} điểm` : null].filter(Boolean).join(" • ")}
                  </Typography>
                </ExperienceOperatorCard>
              ))
            ) : (
              <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có dữ liệu công khai.</Typography>
            )}
          </Stack>
        ) : null}
        {tab === "bracket" ? (
          model.hasBracket ? (
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Nhánh đấu có trên hồ sơ — xem chi tiết khi công bố đầy đủ.</Typography>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>Chưa có nhánh đấu công khai.</Typography>
          )
        ) : null}
        {tab === "media" ? (
          <Typography sx={{ fontSize: 12.5, color: TOURNAMENT_COLOR.textMuted }}>
            {model.mediaAvailable ? "Truyền thông công khai có sẵn." : "Chưa có nội dung truyền thông công khai."}
          </Typography>
        ) : null}
      </Container>
    </Box>
  );
}
