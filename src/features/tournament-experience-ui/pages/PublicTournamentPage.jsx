import { useState } from "react";
import { Box, Button, Container, Grid, Stack, Tab, Tabs, Typography } from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";

import PrototypeBanner from "../components/PrototypeBanner.jsx";
import TournamentIdentitySurface from "../components/TournamentIdentitySurface.jsx";
import TournamentStatusChip from "../components/TournamentStatusChip.jsx";
import { MatchCard, OperatorCard } from "../components/prototypeCards.jsx";
import { TOURNAMENT_COLOR, TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE, TOURNAMENT_RADIUS } from "../design/tournamentDesignTokens.js";
import { FIXTURE_GROUP_STANDINGS, FIXTURE_KO_ROUNDS, FIXTURE_MATCH_REGISTRY, FIXTURE_PUBLIC_REGISTRATION_STATE } from "../fixtures/opsFixture.js";
import { FIXTURE_EVENTS, getFixtureTournament } from "../fixtures/prototypeFixture.js";

const TABS = [
  { id: "overview", label: "Tổng quan" },
  { id: "schedule", label: "Lịch thi đấu" },
  { id: "live", label: "Trực tiếp" },
  { id: "standings", label: "Bảng xếp hạng" },
  { id: "bracket", label: "Nhánh đấu" },
  { id: "results", label: "Kết quả" },
  { id: "media", label: "Truyền thông" },
];

function publicCta(state) {
  if (state === "OPEN") return { label: "Đăng ký ngay", disabled: false };
  return { label: "Đã đóng đăng ký", disabled: true };
}

export default function PublicTournamentPage() {
  const { tournamentId } = useParams();
  const tournament = getFixtureTournament(tournamentId);
  const [tab, setTab] = useState("overview");
  const cta = publicCta(FIXTURE_PUBLIC_REGISTRATION_STATE);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: TOURNAMENT_COLOR.pageBg, overflowX: "hidden" }} data-testid="public-tournament-page">
      <PrototypeBanner />
      <Box
        data-testid="public-site-header"
        sx={{ px: 2, py: 1.1, bgcolor: TOURNAMENT_COLOR.navy, color: "#FFF" }}
      >
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
          }}
        >
          <TournamentIdentitySurface
            gradient={`linear-gradient(120deg, ${TOURNAMENT_COLOR.navy} 0%, #16325C 42%, ${TOURNAMENT_COLOR.primary} 100%)`}
          >
            <Box sx={{ px: { xs: 1.75, md: 2.25 }, py: { xs: 1.5, md: 2 } }}>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 0.7, flexWrap: "wrap" }}>
                <Box sx={{ px: 1, py: 0.2, borderRadius: 99, border: "1px solid rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700 }}>
                  {tournament.typeLabel}
                </Box>
                <TournamentStatusChip tone="success" label="ĐANG DIỄN RA" />
              </Stack>
              <Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 800, lineHeight: 1.1 }}>
                {tournament.name}
              </Typography>
              <Typography sx={{ fontSize: 13, mt: 0.75, opacity: 0.92 }}>
                {tournament.dates} • {tournament.location}
              </Typography>
              <Button
                variant="contained"
                size="small"
                disabled={cta.disabled}
                sx={{ mt: 1.25, ...(cta.disabled ? { bgcolor: TOURNAMENT_COLOR.disabled } : {}) }}
              >
                {cta.label}
              </Button>
            </Box>
          </TournamentIdentitySurface>
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
              {FIXTURE_EVENTS.map((event) => (
                <Grid key={event.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <OperatorCard>
                    <Typography sx={{ fontWeight: 700 }}>{event.name}</Typography>
                    <Typography sx={{ fontSize: 12 }}>{event.pairs} cặp • {event.stage}</Typography>
                  </OperatorCard>
                </Grid>
              ))}
            </Grid>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Trận đang diễn ra</Typography>
            {FIXTURE_MATCH_REGISTRY.filter((row) => row.status === "live").map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
            <Typography sx={{ fontWeight: 700, mt: 1.5, mb: 1 }}>Lịch hôm nay</Typography>
            {FIXTURE_MATCH_REGISTRY.slice(0, 3).map((match) => (
              <MatchCard key={`today-${match.id}`} match={match} />
            ))}
          </>
        ) : null}
        {tab === "live" ? FIXTURE_MATCH_REGISTRY.filter((row) => row.status === "live").map((match) => (
          <MatchCard key={match.id} match={match} />
        )) : null}
        {tab === "standings" || tab === "results" ? (
          <Stack spacing={0.75}>
            {FIXTURE_GROUP_STANDINGS.map((row) => (
              <OperatorCard key={row.rank}>
                <Typography sx={{ fontWeight: 700 }}>{row.rank}. {row.pair}</Typography>
                <Typography sx={{ fontSize: 12 }}>{row.points} điểm • {row.qual}</Typography>
              </OperatorCard>
            ))}
          </Stack>
        ) : null}
        {tab === "schedule" ? (
          <Stack spacing={0.75}>
            {FIXTURE_MATCH_REGISTRY.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </Stack>
        ) : null}
        {tab === "bracket" ? (
          <OperatorCard>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Xem trước nhánh đấu</Typography>
            {FIXTURE_KO_ROUNDS.map((round) => (
              <Typography key={round} sx={{ fontSize: 13 }}>{round}</Typography>
            ))}
          </OperatorCard>
        ) : null}
        {tab === "media" ? (
          <Typography sx={{ fontSize: 13, color: TOURNAMENT_COLOR.textMuted }}>
            Thư viện truyền thông mẫu — chế độ xem, không phải giao diện điều hành.
          </Typography>
        ) : null}
        <Button
          component={RouterLink}
          to={`${TOURNAMENT_EXPERIENCE_PROTOTYPE_BASE}/t/${tournament.id}`}
          size="small"
          sx={{ mt: 2 }}
        >
          Tổng quan điều hành (nguyên mẫu)
        </Button>
      </Container>
    </Box>
  );
}
